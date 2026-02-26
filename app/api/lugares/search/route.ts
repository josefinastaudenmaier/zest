import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractChipsFromQuestions } from "@/lib/questionChips";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";
import type { PlaceResult } from "@/types/places";

export const dynamic = "force-dynamic";

// Expansión semántica: cada término del usuario se expande a keywords que buscar en nombre/reseña/tipo
const SEMANTIC_MAP: Record<string, string[]> = {
  "pet friendly": ["perro", "perros", "mascota", "mascotas", "pet friendly", "pet-friendly", "dog friendly"],
  "para perros": ["perro", "perros", "mascota", "mascotas", "pet friendly"],
  tranquilo: ["tranquilo", "tranquila", "silencioso", "calmado", "relajado", "íntimo", "intimo"],
  silencioso: ["tranquilo", "tranquila", "silencioso", "calmado"],
  movido: ["movido", "música", "musica", "animado", "vivo", "fiesta"],
  wifi: ["wifi", "internet", "trabajar", "trabajo", "laptop", "enchufe", "conexión", "conexion"],
  "para trabajar": ["wifi", "internet", "trabajar", "laptop", "enchufe"],
  "para estudiar": ["wifi", "internet", "estudiar", "laptop", "tranquilo"],
  reservar: ["reservar", "reserva", "reservación", "lleno", "espera"],
  terraza: ["terraza", "afuera", "exterior", "aire libre", "jardín", "jardin", "patio", "vereda"],
  "al aire libre": ["terraza", "afuera", "exterior", "jardín", "patio", "vereda"],
  romántico: ["romántico", "romantico", "pareja", "cita", "intimidad"],
  "para una cita": ["romántico", "romantico", "pareja", "cita", "intimidad"],
  familiar: ["familiar", "niños", "chicos", "kids"],
  "con niños": ["familiar", "niños", "chicos", "kids"],
  barato: ["económico", "economico", "barato", "accesible", "buen precio"],
  económico: ["económico", "economico", "barato", "accesible", "buen precio"],
  "sin tacc": ["sin tacc", "celíaco", "celiaco", "gluten free", "sin gluten"],
  vegano: ["vegano", "vegana", "vegan", "plant based", "vegetariano"],
  vegetariano: ["vegetariano", "vegetariana", "vegano", "plant based"],
  desayuno: ["desayuno", "breakfast", "tostadas", "medialuna", "café con leche", "croissant"],
  brunch: ["brunch"],
  almuerzo: ["almuerzo", "lunch", "menú del día"],
  cena: ["cena", "dinner", "cenar", "noche"],
  café: ["café", "cafe", "coffee", "especialidad"],
  "café de especialidad": ["café", "especialidad", "specialty", "barista", "filtrado"],
  sushi: ["sushi", "japonés", "japonesa", "nikkei", "sashimi", "ramen"],
  pizza: ["pizza", "pizzería", "pizzeria", "napolitana"],
  hamburguesa: ["hamburguesa", "burger", "smash"],
  pasta: ["pasta", "pastas", "trattoria", "italiano", "italiana"],
  tacos: ["tacos", "taquería", "mexicano", "mexicana"],
  helado: ["helado", "gelato", "heladería"],
  empanadas: ["empanadas", "empanada"],
  parrilla: ["parrilla", "asado", "bife", "argentino"],
  bodegón: ["bodegón", "bodegon", "cantina", "casero"],
  bar: ["bar", "wine bar", "copa", "vino", "vermú", "vermu"],
  "wine bar": ["wine bar", "vino", "copa", "natural wine"],
  cerveza: ["cerveza", "birra", "craft", "artesanal"],
};

function expandQuery(q: string): string[] {
  const normalized = q.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terms = new Set<string>([normalized]);

  for (const [key, expansions] of Object.entries(SEMANTIC_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(normalizedKey)) {
      for (const exp of expansions) {
        terms.add(exp.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      }
    }
  }
  return Array.from(terms);
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function scoreRow(
  row: Record<string, unknown>,
  terms: string[]
): number {
  const nombre = normalize(String(row.nombre ?? ""));
  const resena = normalize(String(row.review_text_published ?? ""));
  const tipo = normalize(String(row.tipo_comida ?? ""));
  const hasResena = resena.trim().length > 10;

  let score = 0;
  for (const term of terms) {
    if (nombre.includes(term)) score += 10;
    if (tipo.includes(term)) score += 5;
    if (hasResena && resena.includes(term)) score += 3;
  }

  // Sin reseña: penalizar para que vayan al final
  if (!hasResena && score > 0) score -= 2;
  if (!hasResena && score === 0) score = -1;

  return score;
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
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const pais = searchParams.get("pais") ?? "";
  const ciudad = searchParams.get("ciudad") ?? "";

  const supabase = createClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  const { data: rawData, error } = await supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena, questions")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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

  // Filtrar por ciudad si hay seleccionada
  let data: Record<string, unknown>[] = baseRows.filter((row) => {
    if (!cityFilter) return true;
    const rawCity = extractCityFromAddress((row.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return city ? city.toLowerCase() === cityFilter : false;
  });

  // Expandir la query con sinónimos semánticos
  const terms = q.trim() ? expandQuery(q) : [];

  // Filtrar: incluir si score > 0 O si no hay query
  if (terms.length > 0) {
    data = data.filter((row) => scoreRow(row, terms) > 0);
  }

  // Deduplicar
  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    const key = String(row.google_maps_url ?? row.nombre ?? row.id ?? "");
    if (!key) continue;
    if (!dedup.has(key)) dedup.set(key, row);
  }

  // Ordenar por relevancia semántica (score desc), luego por rating
  const sorted = Array.from(dedup.values()).sort((a, b) => {
    const scoreA = scoreRow(a, terms);
    const scoreB = scoreRow(b, terms);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const ratingA = (a.five_star_rating_published as number) ?? 0;
    const ratingB = (b.five_star_rating_published as number) ?? 0;
    return ratingB - ratingA;
  });

  const results = sorted.map((row) => {
    const r = row as Record<string, unknown>;
    const questions = r.questions as Array<{ question?: string; selected_option?: string }> | null | undefined;
    const chips = extractChipsFromQuestions(questions);
    const mapped = lugarToPlaceResult(r, chips);
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return { ...mapped, ciudad: city ?? undefined };
  });

  return NextResponse.json({ results });
}