import { NextRequest, NextResponse } from "next/server";
import { getPlacePhotoUrl } from "@/lib/places";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";

export const dynamic = "force-dynamic";

const MIN_RATING = 4.3;
const MIN_REVIEWS = 50;
const MAX_REVIEWS = 8_000;

/** Tipos principales permitidos (al menos uno). */
const ALLOWED_MAIN_TYPES = ["restaurant", "cafe", "bar", "bakery", "food"];

/** Tipos que excluyen el lugar. */
const EXCLUDED_TYPES = [
  "lodging",
  "hotel",
  "store",
  "supermarket",
  "gas_station",
  "pharmacy",
  "hospital",
  "gym",
  "school",
  "dance_school",
  "beauty_salon",
  "hair_care",
  "spa",
];

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function mapType(types: string[] | undefined): string {
  if (!types?.length) return "Lugar";
  if (types.some((t) => t.includes("restaurant"))) return "Restaurante";
  if (types.some((t) => t.includes("cafe"))) return "Café";
  if (types.some((t) => t.includes("bar"))) return "Bar";
  if (types.some((t) => t.includes("bakery"))) return "Panadería";
  return "Lugar";
}

function normalizeType(t: string): string {
  return (t ?? "").trim().toLowerCase();
}

function hasAllowedMainType(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  const normalized = types.map(normalizeType);
  return ALLOWED_MAIN_TYPES.some((allowed) =>
    normalized.some((t) => t.includes(allowed) || allowed.includes(t))
  );
}

function hasExcludedType(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  const normalized = types.map(normalizeType);
  return EXCLUDED_TYPES.some((excl) =>
    normalized.some((t) => t.includes(excl) || excl.includes(t))
  );
}

function meetsQualityCriteria(p: {
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}): boolean {
  const rating = p.rating ?? 0;
  const total = p.user_ratings_total ?? 0;
  if (rating < MIN_RATING) return false;
  if (total < MIN_REVIEWS || total > MAX_REVIEWS) return false;
  if (!hasAllowedMainType(p.types)) return false;
  if (hasExcludedType(p.types)) return false;
  return true;
}

type RawPlace = {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photos?: Array<{ photo_reference: string }>;
  geometry?: { location: { lat: number; lng: number } };
};

type WithDistance = RawPlace & { distance?: number };

async function fetchNearby(
  key: string,
  location: string,
  type: string,
  radius: number
): Promise<RawPlace[]> {
  const url = `${GOOGLE_API}/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${key}&language=es`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
  const list = (data.results || []) as RawPlace[];
  return list;
}

function addDistance(
  list: RawPlace[],
  latNum: number,
  lngNum: number
): WithDistance[] {
  return list.map((p) => {
    const loc = p.geometry?.location;
    const distance = loc
      ? haversineDistance(latNum, lngNum, loc.lat, loc.lng)
      : undefined;
    return { ...p, distance };
  });
}

/**
 * Busca lugares por uno o más tipos, aplica criterios de calidad, ordena por rating.
 * Si no hay suficientes a 1000m, repite con 2000m para esa categoría.
 */
async function fetchCategory(
  key: string,
  location: string,
  latNum: number,
  lngNum: number,
  types: string[],
  needed: number
): Promise<WithDistance[]> {
  let radius = 1000;
  let out: WithDistance[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < 2; attempt++) {
    const promises = types.map((type) =>
      fetchNearby(key, location, type, radius)
    );
    const results = await Promise.all(promises);
    const withDist = results.flatMap((list) =>
      addDistance(list, latNum, lngNum)
    );
    const unique = withDist.filter((p) => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });
    const filtered = unique.filter(meetsQualityCriteria);
    filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    out = filtered.slice(0, needed);
    if (out.length >= needed) break;
    radius = 2000;
  }
  return out;
}

/**
 * Comodín: el mejor lugar por rating sin importar tipo, excluyendo los ya elegidos.
 */
async function fetchComodin(
  key: string,
  location: string,
  latNum: number,
  lngNum: number,
  excludeIds: Set<string>,
  needed: number
): Promise<WithDistance[]> {
  const types = ["restaurant", "cafe", "bar", "bakery", "food"];
  let radius = 1000;
  const seen = new Set<string>();

  for (let attempt = 0; attempt < 2; attempt++) {
    const promises = types.map((type) =>
      fetchNearby(key, location, type, radius)
    );
    const results = await Promise.all(promises);
    const withDist = results.flatMap((list) =>
      addDistance(list, latNum, lngNum)
    );
    const unique = withDist.filter((p) => {
      if (seen.has(p.place_id)) return false;
      if (excludeIds.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });
    const filtered = unique.filter(meetsQualityCriteria);
    filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const out = filtered.slice(0, needed);
    if (out.length >= needed) return out;
    radius = 2000;
  }
  return [];
}

/** Mezcla un array (Fisher-Yates) para no mostrar agrupado por tipo. */
function shuffle<T>(array: T[]): T[] {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Google Maps API key no configurada" },
      { status: 500 }
    );
  }
  const latNum = parseFloat(lat ?? "");
  const lngNum = parseFloat(lng ?? "");
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return NextResponse.json(
      { error: "Parámetros lat y lng requeridos" },
      { status: 400 }
    );
  }

  const location = `${latNum},${lngNum}`;

  // 1) 2 cafés o panaderías
  const cafes = await fetchCategory(
    key,
    location,
    latNum,
    lngNum,
    ["cafe", "bakery"],
    2
  );
  // 2) 2 restaurantes
  const restaurants = await fetchCategory(
    key,
    location,
    latNum,
    lngNum,
    ["restaurant"],
    2
  );
  // 3) 1 bar
  const bars = await fetchCategory(
    key,
    location,
    latNum,
    lngNum,
    ["bar"],
    1
  );

  const selectedIds = new Set<string>();
  [...cafes, ...restaurants, ...bars].forEach((p) => selectedIds.add(p.place_id));

  // 4) 1 comodín (mejor por rating excluyendo ya elegidos)
  const comodin = await fetchComodin(
    key,
    location,
    latNum,
    lngNum,
    selectedIds,
    1
  );

  const combined: WithDistance[] = [
    ...cafes,
    ...restaurants,
    ...bars,
    ...comodin,
  ].filter(Boolean);
  const mixed = shuffle(combined);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const results = mixed.map((p) => {
    const photoRef = p.photos?.[0]?.photo_reference;
    const photo_url =
      photoRef && apiKey ? getPlacePhotoUrl(photoRef, 400) : undefined;
    return {
      place_id: p.place_id,
      name: p.name,
      vicinity: p.vicinity,
      rating: p.rating,
      user_ratings_total: p.user_ratings_total,
      type: mapType(p.types),
      types: p.types ?? [],
      photo_reference: photoRef,
      photo_url,
      distance_m: p.distance != null ? Math.round(p.distance) : null,
    };
  });

  return NextResponse.json({ results });
}
