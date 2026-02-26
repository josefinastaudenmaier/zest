import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractChipsFromQuestions } from "@/lib/questionChips";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase no configurado" },
      { status: 500 }
    );
  }
  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const pais = searchParams.get("pais") ?? "";
  const ciudad = searchParams.get("ciudad") ?? "";
  const cityFilter = ciudad.trim().toLowerCase();

  const supabase = createClient(url, key);
  let query = supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena, questions")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false });

  // Si no hay ciudad seleccionada, limitamos para mantener respuesta liviana.
  // Si hay ciudad seleccionada, traemos todas las recomendaciones de esa ciudad.
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

  const rows = baseRows.filter((row) => {
    if (!cityFilter) return true;
    const r = row as Record<string, unknown>;
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return city ? city.toLowerCase() === cityFilter : false;
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
      distance_m: null,
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
