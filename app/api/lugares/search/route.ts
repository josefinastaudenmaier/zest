import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { esLugarDeComida } from "@/lib/excludeNonFood";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";
import type { PlaceResult } from "@/types/places";

export const dynamic = "force-dynamic";
const RESULT_LIMIT = 10;
const SEARCH_LIMIT = 7;

function toNaturalSearchError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("user_search_limits") && (m.includes("schema cache") || m.includes("could not find"))) {
    return "Estamos terminando de activar el límite de búsquedas. Probá de nuevo en unos segundos.";
  }
  if (m.includes("relation") && m.includes("does not exist")) {
    return "Hubo un problema de configuración. Estamos trabajando para resolverlo.";
  }
  if (m.includes("jwt") || m.includes("token") || m.includes("auth")) {
    return "Tu sesión venció. Iniciá sesión de nuevo para seguir buscando.";
  }
  return "Tuvimos un problema al procesar la búsqueda. Probá nuevamente.";
}

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

const DISH_SYNONYM_GROUPS: string[][] = [
  ["medialuna", "medialunas", "croissant", "factura", "facturas", "viennoiserie"],
  ["hamburguesa", "hamburguesas", "burger", "burgers", "smash"],
  ["papas fritas", "papas", "fries", "fritas"],
  ["cafe", "cafes", "coffee", "cafeteria"],
  ["helado", "helados", "gelato"],
  ["empanada", "empanadas"],
  ["taco", "tacos", "taqueria", "taquerias"],
  ["pizza", "pizzas", "muzza", "muzzarella", "napolitana"],
  ["pasta", "pastas", "fideos", "spaghetti", "ravioles"],
  ["sushi", "sashimi", "nigiri", "maki"],
];

function normalizeText(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function expandQuery(q: string): string[] {
  const normalized = normalizeText(q);
  const terms = new Set<string>([normalized]);
  const words = normalized.split(/\s+/).filter(Boolean);
  const bigrams = words.map((w, i) => (i < words.length - 1 ? `${w} ${words[i + 1]}` : "")).filter(Boolean);

  for (const [key, expansions] of Object.entries(SEMANTIC_MAP)) {
    const normalizedKey = normalizeText(key);
    if (normalized.includes(normalizedKey)) {
      for (const exp of expansions) {
        terms.add(normalizeText(exp));
      }
    }
  }

  const candidates = new Set<string>([...words, ...bigrams, normalized]);
  const candidateList = Array.from(candidates);
  for (const group of DISH_SYNONYM_GROUPS) {
    const normalizedGroup = group.map((g) => normalizeText(g));
    const hasAny = normalizedGroup.some((syn) =>
      candidateList.some((cand) => cand === syn || cand.includes(syn) || syn.includes(cand))
    );
    if (hasAny) {
      for (const syn of normalizedGroup) terms.add(syn);
    }
  }
  return Array.from(terms);
}

function normalize(s: string): string {
  return normalizeText(s);
}

function extractCityHintFromQuery(q: string): string | null {
  const nq = normalize(q).trim();
  if (!nq) return null;

  // Ej: "cafes en londres", "pizza en ciudad de mexico"
  const match = nq.match(/\ben\s+([a-z0-9\s.'-]{2,})$/i);
  if (!match) return null;
  const raw = match[1]
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b(argentina|spain|españa|italia|francia|uk|usa|eeuu)\b$/i, "")
    .trim();
  return raw || null;
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

function normalizeForKey(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, " ").replace(/\s{2,}/g, " ").trim();
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

function pickBetterRow(a: Record<string, unknown>, b: Record<string, unknown>, terms: string[]): Record<string, unknown> {
  const visitA = visitedScore(a);
  const visitB = visitedScore(b);
  if (visitB > visitA) return b;
  if (visitA > visitB) return a;

  const scoreA = scoreRow(a, terms);
  const scoreB = scoreRow(b, terms);
  if (scoreB > scoreA) return b;
  if (scoreA > scoreB) return a;

  const ratingA = (a.five_star_rating_published as number) ?? 0;
  const ratingB = (b.five_star_rating_published as number) ?? 0;
  return ratingB > ratingA ? b : a;
}

function nameKey(row: Record<string, unknown>): string {
  return normalizeForKey(String(row.nombre ?? ""));
}

function scoreRow(
  row: Record<string, unknown>,
  terms: string[]
): number {
  const nombre = normalize(String(row.nombre ?? ""));
  const resena = normalize(String(row.review_text_published ?? ""));
  const tipo = normalize(String(row.tipo_comida ?? ""));
  const direccion = normalize(String(row.direccion ?? ""));
  const preguntas = normalize(
    Array.isArray(row.questions)
      ? (row.questions as Array<{ question?: string; selected_option?: string }>)
          .map((q) => `${q.question ?? ""} ${q.selected_option ?? ""}`.trim())
          .join(" ")
      : ""
  );
  const hasResena = resena.trim().length > 10;
  const hasQuestions = preguntas.trim().length > 0;

  let score = 0;
  for (const term of terms) {
    if (nombre.includes(term)) score += 10;
    if (tipo.includes(term)) score += 5;
    if (direccion.includes(term)) score += 4;
    if (hasQuestions && preguntas.includes(term)) score += 6;
    if (hasResena && resena.includes(term)) score += 3;
  }

  // Sin reseña: penalizar, pero si hay señales en questions/dirección no castigamos tanto.
  if (!hasResena && score > 0) score -= hasQuestions ? 1 : 2;
  if (!hasResena && score === 0) score = hasQuestions ? 0 : -1;

  return score;
}

function lugarToPlaceResult(
  row: Record<string, unknown>
): PlaceResult & {
  google_maps_url?: string;
  ciudad?: string;
  pais?: string;
  resena_personal?: string;
  fecha_resena?: string;
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
    google_maps_url: googleMapsUrl ?? undefined,
    ciudad: ciudad ?? undefined,
    pais: pais ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !serviceKey) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }
  const authSupabase = await createServerClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Iniciá sesión para buscar lugares." }, { status: 401 });
  }

  const adminSupabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usageRow, error: usageError } = await adminSupabase
    .from("user_search_limits")
    .select("search_count")
    .eq("user_id", user.id)
    .maybeSingle();
  if (usageError) {
    return NextResponse.json({ error: toNaturalSearchError(usageError.message) }, { status: 400 });
  }

  const currentSearchCount = usageRow?.search_count ?? 0;
  if (currentSearchCount >= SEARCH_LIMIT) {
    return NextResponse.json(
      { error: "Alcanzaste tu límite histórico de 7 búsquedas." },
      { status: 429 }
    );
  }

  const { error: upsertLimitError } = await adminSupabase.from("user_search_limits").upsert(
    {
      user_id: user.id,
      search_count: currentSearchCount + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertLimitError) {
    return NextResponse.json({ error: toNaturalSearchError(upsertLimitError.message) }, { status: 400 });
  }

  const { searchParams } = request.nextUrl ?? new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const pais = searchParams.get("pais") ?? "";
  const ciudad = searchParams.get("ciudad") ?? "";

  const supabase = createSupabaseClient(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  const { data: rawData, error } = await supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, lat, lng, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, fecha_resena, questions")
    .order("five_star_rating_published", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: toNaturalSearchError(error.message) }, { status: 400 });
  }

  const requestedCityFilter = ciudad.trim().toLowerCase();

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

  const availableCities = Array.from(
    new Set(
      baseRows
        .map((row) => {
          const rawCity = extractCityFromAddress((row.direccion as string | null) ?? null);
          const city = canonicalizeCity(rawCity, canonicalMap);
          return city ? city.trim() : "";
        })
        .filter(Boolean)
    )
  );

  const cityHint = extractCityHintFromQuery(q);
  const hintedCity =
    cityHint &&
    (availableCities.find((c) => normalize(c) === cityHint) ??
      availableCities.find((c) => normalize(c).includes(cityHint) || cityHint.includes(normalize(c))) ??
      null);

  // Prioridad: ciudad detectada en query > ciudad enviada por selector.
  const cityFilter = hintedCity ? hintedCity.toLowerCase() : requestedCityFilter;

  // Filtrar por ciudad si hay seleccionada
  let data: Record<string, unknown>[] = baseRows.filter((row) => {
    if (!cityFilter) return true;
    const rawCity = extractCityFromAddress((row.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return city ? city.toLowerCase() === cityFilter : false;
  });

  // Expandir la query con sinónimos semánticos
  const terms = q.trim() ? expandQuery(q) : [];

  // Filtrar: incluir si score > 0 O si hay otra fila del mismo lugar con score > 0.
  // Esto evita perder la versión "visitada" cuando solo matchea semánticamente la duplicada.
  if (terms.length > 0) {
    const matchingNames = new Set(
      data
        .filter((row) => scoreRow(row, terms) > 0)
        .map((row) => nameKey(row))
        .filter(Boolean)
    );

    data = data.filter((row) => {
      if (scoreRow(row, terms) > 0) return true;
      const key = nameKey(row);
      return key ? matchingNames.has(key) : false;
    });
  }

  // Deduplicar
  const dedup = new Map<string, Record<string, unknown>>();
  for (const row of data) {
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

  // Ordenar por relevancia semántica (score desc), luego por rating
  const sorted = Array.from(dedup.values()).sort((a, b) => {
    const scoreA = scoreRow(a, terms);
    const scoreB = scoreRow(b, terms);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const ratingA = (a.five_star_rating_published as number) ?? 0;
    const ratingB = (b.five_star_rating_published as number) ?? 0;
    return ratingB - ratingA;
  });

  const collapsedSorted: Record<string, unknown>[] = [];
  for (const row of sorted) {
    const i = collapsedSorted.findIndex((saved) => isSamePlaceLoose(saved, row));
    if (i === -1) {
      collapsedSorted.push(row);
      continue;
    }
    collapsedSorted[i] = pickBetterRow(collapsedSorted[i], row, terms);
  }

  const collapsedByName = new Map<string, Record<string, unknown>>();
  for (const row of collapsedSorted) {
    const key = nameKey(row);
    if (!key) continue;
    const current = collapsedByName.get(key);
    if (!current) {
      collapsedByName.set(key, row);
      continue;
    }
    collapsedByName.set(key, pickBetterRow(current, row, terms));
  }

  const finalRows = Array.from(collapsedByName.values()).sort((a, b) => {
    const scoreA = scoreRow(a, terms);
    const scoreB = scoreRow(b, terms);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const ratingA = (a.five_star_rating_published as number) ?? 0;
    const ratingB = (b.five_star_rating_published as number) ?? 0;
    return ratingB - ratingA;
  });

  const results = finalRows.slice(0, RESULT_LIMIT).map((row) => {
    const r = row as Record<string, unknown>;
    const mapped = lugarToPlaceResult(r);
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    return { ...mapped, ciudad: city ?? undefined };
  });

  return NextResponse.json({ results });
}
