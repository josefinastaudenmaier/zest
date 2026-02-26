import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractChipsFromQuestions } from "@/lib/questionChips";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";
import type { PlaceResult } from "@/types/places";

export const dynamic = "force-dynamic";

/** Palabras que expanden búsqueda semántica (pet friendly, tranquilo, etc.) en resena_personal */
const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  "pet friendly": ["perro", "perros", "mascota", "mascotas", "pet friendly", "pet-friendly", "dog friendly"],
  tranquilo: ["tranquilo", "tranquila", "silencioso", "calmado", "relajado", "íntimo", "intimo"],
  movido: ["movido", "música", "musica", "animado", "vivo", "fiesta"],
  wifi: ["wifi", "internet", "trabajar", "trabajo", "laptop", "enchufe", "conexión", "conexion"],
  reservar: ["reservar", "reserva", "reservación", "reservacion", "lleno", "espera"],
  terraza: ["terraza", "afuera", "exterior", "al aire libre", "jardín", "jardin", "parque"],
  romántico: ["romántico", "romantico", "pareja", "cita", "intimidad"],
  familiar: ["familiar", "niños", "niños", "chicos", "kids"],
  "precio bajo": ["económico", "economico", "barato", "barata", "accesible", "buen precio"],
  "precio alto": ["caro", "cara", "precio elevado", "costoso"],
};

function buildSearchQuery(q: string): string {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) return "";
  const terms: string[] = [trimmed];
  for (const [label, keywords] of Object.entries(SEMANTIC_KEYWORDS)) {
    if (keywords.some((kw) => trimmed.includes(kw))) {
      terms.push(label);
    }
  }
  return terms.join(" ");
}

function lugarToPlaceResult(
  row: Record<string, unknown>,
  chips: Array<{ label: string; icon: string }>
): PlaceResult & {
  google_maps_url?: string;
  ciudad?: string;
  pais?: string;
  resena_personal?: string;
  fecha_resena?: string;
  chips?: Array<{ label: string; icon: string }>;
} {
  const id = row.id as string;
  const nombre = (row.nombre as string) ?? "";
  const direccion = (row.direccion as string) ?? null;
  const rating = row.five_star_rating_published as number | null;
  const lat = row.lat as number | null;
  const lng = row.lng as number | null;
  const resena = (row.review_text_published as string) ?? null;
  const fechaResena = (row.fecha_resena as string) ?? null;
  const tipoComida = (row.tipo_comida as string) ?? null;
  const googleMapsUrl = (row.google_maps_url as string) ?? null;
  const ciudad = extractCityFromAddress((row.direccion as string | null) ?? null);
  const pais = (row.pais as string) ?? null;
  return {
    place_id: id,
    name: nombre,
    formatted_address: direccion ?? undefined,
    vicinity: direccion ?? undefined,
    rating: rating ?? undefined,
    user_ratings_total: undefined,
    geometry:
      lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
        ? { location: { lat, lng } }
        : undefined,
    types: tipoComida ? [tipoComida] : undefined,
    resena_personal: resena ?? undefined,
    fecha_resena: fechaResena ?? undefined,
    chips,
    google_maps_url: googleMapsUrl ?? undefined,
    ciudad: ciudad ?? undefined,
    pais: pais ?? undefined,
  };
}

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
  const q = searchParams.get("q") ?? "";
  const pais = searchParams.get("pais") ?? "";
  const ciudad = searchParams.get("ciudad") ?? "";

  const supabase = createClient(url, key);
  let query = supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena, questions")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false })
    .limit(2000);

  const { data: rawData, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const searchTerm = q.trim().replace(/%/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const cityFilter = ciudad.trim().toLowerCase();
  const baseRows: Record<string, unknown>[] = (rawData ?? []).filter((row) => {
    if (!esLugarDeComida(String(row.nombre ?? ""))) return false;
    if (!pais.trim()) return true;
    return String(row.pais ?? "").toUpperCase() === pais.trim().toUpperCase();
  });

  const canonicalMap = buildCanonicalCityMap(
    baseRows.map((r) => ({
      direccion: (r.direccion as string | null) ?? null,
      lat: r.lat as number | null,
      lng: r.lng as number | null,
    })),
    50
  );

  let data: Record<string, unknown>[] = baseRows.filter((row) => {
    if (!cityFilter) return true;
    const rawCity = extractCityFromAddress((row.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return city ? city.toLowerCase() === cityFilter : false;
  });
  if (searchTerm) {
    data = data.filter((row) => {
      const nombre = String(row.nombre ?? "").toLowerCase();
      const review = String(row.review_text_published ?? "").toLowerCase();
      const tipo = String(row.tipo_comida ?? "").toLowerCase();
      return nombre.includes(searchTerm) || review.includes(searchTerm) || tipo.includes(searchTerm);
    });
  }

  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    const key = String(row.google_maps_url ?? row.nombre ?? row.id ?? "");
    if (!key) continue;
    if (!dedup.has(key)) dedup.set(key, row);
  }

  let results = Array.from(dedup.values()).map((row) => {
    const r = row as Record<string, unknown>;
    const questions = r.questions as Array<{ question?: string; selected_option?: string }> | null | undefined;
    const chips = extractChipsFromQuestions(questions);
    const mapped = lugarToPlaceResult(r, chips);
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return { ...mapped, ciudad: city ?? undefined };
  });

  if (q.trim()) {
    const searchTerm = buildSearchQuery(q);
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      results = results.filter((r) => {
        const text = [
          r.name,
          r.resena_personal ?? "",
          r.types?.join(" ") ?? "",
        ].join(" ").toLowerCase();
        return terms.some((t) => text.includes(t));
      });
    }
  }

  return NextResponse.json({ results });
}
