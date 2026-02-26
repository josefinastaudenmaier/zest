import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";

export const dynamic = "force-dynamic";

const QUERY_LIMIT = 100;
const RESULT_LIMIT = 10;
const MAX_DISTANCE_M = 3000;

function normalizeForKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeMapsUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return normalizeForKey(raw);
  }
}

function rowDedupKey(row: Record<string, unknown>): string {
  const name = normalizeForKey(String(row.nombre ?? ""));
  const address = normalizeForKey(String(row.direccion ?? ""));
  if (name && address) return `na:${name}|${address}`;

  const mapsUrl = String(row.google_maps_url ?? "").trim();
  if (mapsUrl) return `gm:${normalizeMapsUrl(mapsUrl)}`;

  if (name) return `n:${name}`;
  return `id:${String(row.id ?? "")}`;
}

function visitedScore(row: Record<string, unknown>): number {
  const rating = row.five_star_rating_published as number | null;
  const review = String(row.review_text_published ?? "").trim();
  const hasRating = typeof rating === "number" && !Number.isNaN(rating);
  const hasReview = review.length > 0;
  if (hasRating && hasReview) return 3;
  if (hasReview) return 2;
  if (hasRating) return 1;
  return 0;
}

function isSamePlaceLoose(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aUrl = String(a.google_maps_url ?? "").trim();
  const bUrl = String(b.google_maps_url ?? "").trim();
  if (aUrl && bUrl && normalizeMapsUrl(aUrl) === normalizeMapsUrl(bUrl)) return true;

  const nameA = normalizeForKey(String(a.nombre ?? ""));
  const nameB = normalizeForKey(String(b.nombre ?? ""));
  if (!nameA || !nameB || nameA !== nameB) return false;

  const aLat = a.lat as number | null;
  const aLng = a.lng as number | null;
  const bLat = b.lat as number | null;
  const bLng = b.lng as number | null;
  const hasCoordsA = aLat != null && aLng != null && !Number.isNaN(aLat) && !Number.isNaN(aLng);
  const hasCoordsB = bLat != null && bLng != null && !Number.isNaN(bLat) && !Number.isNaN(bLng);
  if (hasCoordsA && hasCoordsB) {
    return distanceM(aLat, aLng, bLat, bLng) <= 180;
  }

  const cityA = normalizeForKey(extractCityFromAddress((a.direccion as string | null) ?? null) ?? "");
  const cityB = normalizeForKey(extractCityFromAddress((b.direccion as string | null) ?? null) ?? "");
  if (!cityA || !cityB || cityA !== cityB) return false;

  const addrA = normalizeForKey(String(a.direccion ?? ""));
  const addrB = normalizeForKey(String(b.direccion ?? ""));
  if (!addrA || !addrB) return true;
  return addrA === addrB;
}

function pickBetterRow(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const visitA = visitedScore(a);
  const visitB = visitedScore(b);
  if (visitB > visitA) return b;
  if (visitA > visitB) return a;

  const ratingA = (a.five_star_rating_published as number) ?? 0;
  const ratingB = (b.five_star_rating_published as number) ?? 0;
  if (ratingB > ratingA) return b;
  if (ratingA > ratingB) return a;

  const dateA = Date.parse(String(a.fecha_resena ?? ""));
  const dateB = Date.parse(String(b.fecha_resena ?? ""));
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateB > dateA ? b : a;
  return a;
}

function nameKey(row: Record<string, unknown>): string {
  return normalizeForKey(String(row.nombre ?? ""));
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const pais = searchParams.get("pais") ?? "";
  const ciudad = searchParams.get("ciudad") ?? "";
  const applyRadius = searchParams.get("apply_radius") === "1";
  const userLat = parseFloat(searchParams.get("lat") ?? "");
  const userLng = parseFloat(searchParams.get("lng") ?? "");
  const hasUserCoords = !Number.isNaN(userLat) && !Number.isNaN(userLng);
  const cityFilter = ciudad.trim().toLowerCase();

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  let query = supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false });

  if (!cityFilter) {
    query = query.limit(QUERY_LIMIT);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const baseRows = (data ?? []).filter((row) => {
    const r = row as Record<string, unknown>;
    if (!esLugarDeComida(String(r.nombre ?? ""))) return false;
    if (!pais.trim()) return true;
    return String(r.pais ?? "").toUpperCase() === pais.trim().toUpperCase();
  });

  const canonicalMap = buildCanonicalCityMap(
    baseRows.map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        direccion: (rr.direccion as string | null) ?? null,
        lat: rr.lat as number | null,
        lng: rr.lng as number | null,
      };
    }),
    50
  );

  let rows = baseRows.filter((row) => {
    const r = row as Record<string, unknown>;

    // Si hay ciudad seleccionada, filtrar por ciudad
    if (cityFilter) {
      const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
      const city = canonicalizeCity(rawCity, canonicalMap);
      if (!city || city.toLowerCase() !== cityFilter) return false;
    }

    // Aplicar radio solo cuando se pide explícitamente (ciudad detectada/default).
    if (hasUserCoords && applyRadius) {
      const lat = r.lat as number | null;
      const lng = r.lng as number | null;
      if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
      if (distanceM(userLat, userLng, lat, lng) > MAX_DISTANCE_M) return false;
    }

    return true;
  });

  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of rows as Record<string, unknown>[]) {
    const key = rowDedupKey(row);
    const current = dedup.get(key);
    if (!current) {
      dedup.set(key, row);
      continue;
    }

    const currentVisited = visitedScore(current);
    const nextVisited = visitedScore(row);
    if (nextVisited > currentVisited) {
      dedup.set(key, row);
      continue;
    }
    if (nextVisited === currentVisited) {
      const currentRating = (current.five_star_rating_published as number) ?? 0;
      const nextRating = (row.five_star_rating_published as number) ?? 0;
      if (nextRating > currentRating) dedup.set(key, row);
    }
  }
  const uniqueRows = Array.from(dedup.values());
  const collapsedRows: Record<string, unknown>[] = [];
  for (const row of uniqueRows) {
    const i = collapsedRows.findIndex((saved) => isSamePlaceLoose(saved, row));
    if (i === -1) {
      collapsedRows.push(row);
      continue;
    }
    collapsedRows[i] = pickBetterRow(collapsedRows[i], row);
  }

  const collapsedByName = new Map<string, Record<string, unknown>>();
  for (const row of collapsedRows) {
    const key = nameKey(row);
    if (!key) continue;
    const current = collapsedByName.get(key);
    if (!current) {
      collapsedByName.set(key, row);
      continue;
    }
    collapsedByName.set(key, pickBetterRow(current, row));
  }

  const finalRows = Array.from(collapsedByName.values()).sort((a, b) => {
    const ratingA = (a.five_star_rating_published as number) ?? 0;
    const ratingB = (b.five_star_rating_published as number) ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    const visitA = visitedScore(a);
    const visitB = visitedScore(b);
    return visitB - visitA;
  });

  const results = finalRows.slice(0, RESULT_LIMIT).map((row) => {
    const r = row as Record<string, unknown>;
    const rating = r.five_star_rating_published as number | null;
    const lat = r.lat as number | null;
    const lng = r.lng as number | null;
    const tipoComida = (r.tipo_comida as string) ?? null;
    const googleMapsUrl = (r.google_maps_url as string) ?? null;
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const ciudadRes = canonicalizeCity(rawCity, canonicalMap);
    const paisRes = (r.pais as string) ?? null;
    const distancia = hasUserCoords && applyRadius && lat != null && lng != null
      ? Math.round(distanceM(userLat, userLng, lat, lng))
      : null;
    return {
      place_id: r.id,
      name: r.nombre ?? "",
      vicinity: (r.direccion as string) ?? undefined,
      rating: rating ?? undefined,
      user_ratings_total: undefined,
      type: tipoComida ?? "Lugar",
      types: tipoComida ? [tipoComida] : undefined,
      photo_reference: null,
      photo_url: null,
      distance_m: distancia,
      resena_personal: (r.review_text_published as string) ?? undefined,
      fecha_resena: (r.fecha_resena as string) ?? undefined,
      geometry: lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
        ? { location: { lat, lng } }
        : undefined,
      google_maps_url: googleMapsUrl ?? undefined,
      ciudad: ciudadRes ?? undefined,
      pais: paisRes ?? undefined,
    };
  });

  return NextResponse.json({ results });
}
