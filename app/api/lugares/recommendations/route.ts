import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractChipsFromQuestions } from "@/lib/questionChips";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";

export const dynamic = "force-dynamic";

const LIMIT = 100;
const MAX_DISTANCE_M = 5000;

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
  const userLat = parseFloat(searchParams.get("lat") ?? "");
  const userLng = parseFloat(searchParams.get("lng") ?? "");
  const hasUserCoords = !Number.isNaN(userLat) && !Number.isNaN(userLng);
  const cityFilter = ciudad.trim().toLowerCase();

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  let query = supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena, questions")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false });

  if (!cityFilter) {
    query = query.limit(LIMIT);
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
      return city ? city.toLowerCase() === cityFilter : false;
    }

    // Si hay coords del usuario y no hay ciudad seleccionada, filtrar por 5km
    if (hasUserCoords) {
      const lat = r.lat as number | null;
      const lng = r.lng as number | null;
      if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
      return distanceM(userLat, userLng, lat, lng) <= MAX_DISTANCE_M;
    }

    return true;
  });

  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of rows as Record<string, unknown>[]) {
    const key = String(row.google_maps_url ?? row.nombre ?? row.id ?? "");
    if (!key) continue;
    if (!dedup.has(key)) dedup.set(key, row);
  }
  const uniqueRows = Array.from(dedup.values());

  const results = uniqueRows.map((row) => {
    const r = row as Record<string, unknown>;
    const questions = r.questions as Array<{ question?: string; selected_option?: string }> | null | undefined;
    const chips = extractChipsFromQuestions(questions);
    const rating = r.five_star_rating_published as number | null;
    const lat = r.lat as number | null;
    const lng = r.lng as number | null;
    const tipoComida = (r.tipo_comida as string) ?? null;
    const googleMapsUrl = (r.google_maps_url as string) ?? null;
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const ciudadRes = canonicalizeCity(rawCity, canonicalMap);
    const paisRes = (r.pais as string) ?? null;
    const distancia = hasUserCoords && lat != null && lng != null
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
      chips,
      google_maps_url: googleMapsUrl ?? undefined,
      ciudad: ciudadRes ?? undefined,
      pais: paisRes ?? undefined,
    };
  });

  return NextResponse.json({ results });
}