import { NextRequest, NextResponse } from "next/server";
import { isFoodAndDrinkPlace } from "@/lib/placeTypes";
import { getPlacePhotoUrl } from "@/lib/places";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";

export const dynamic = "force-dynamic";

/** Cadenas a excluir en "Abiertos ahora" (solo lugares independientes/destacados). Coincidencia parcial e insensible a mayúsculas. */
const CHAINS_TO_EXCLUDE = [
  "starbucks",
  "mcdonalds",
  "burger king",
  "pain quotidien",
  "havanna",
  "mostaza",
  "subway",
  "kfc",
  "rapipago",
];

const MAX_REVIEWS_CHAIN = 10_000; // Excluir si tiene más de 10k reseñas (volumen masivo)
const MIN_REVIEWS_PREFERRED = 50;
const MAX_REVIEWS_PREFERRED = 5_000;
const MAX_SAME_NAME = 3; // Si un nombre aparece más de 3 veces en resultados, se considera cadena y se excluye

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // metres
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
  if (types.some((t) => t.includes("bar"))) return "Bar";
  if (types.some((t) => t.includes("cafe"))) return "Café";
  return "Lugar";
}

export async function GET(request: NextRequest) {
  // "Abiertos ahora cerca tuyo": solo lugares independientes/destacados.
  // Se excluyen cadenas (lista + nombre repetido >3 veces + >10k reseñas),
  // se prioriza rango 50–5000 reseñas y se ordena por rating. Ver constantes arriba.
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");
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

  const radiusParam = request.nextUrl.searchParams.get("radius");
  const radius = radiusParam ? Math.min(10000, Math.max(1000, parseInt(radiusParam, 10) || 2000)) : 2000;
  const openNow = request.nextUrl.searchParams.get("opennow") !== "false";

  const location = `${latNum},${lngNum}`;
  const minRating = 4; // solo mayor a 4 estrellas
  // Solo comida y bebida: restaurant, cafe, bar, bakery, meal_takeaway, meal_delivery, food, night_club
  const types = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway", "meal_delivery", "food", "night_club"];
  const allResults: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    photos?: Array<{ photo_reference: string }>;
    geometry?: { location: { lat: number; lng: number } };
    distance?: number;
  }> = [];

  for (const type of types) {
    const openParam = openNow ? "&opennow=true" : "";
    const url = `${GOOGLE_API}/nearbysearch/json?location=${location}&radius=${radius}&type=${type}${openParam}&key=${key}&language=es`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") continue;
    const list = data.results || [];
    for (const p of list) {
      const loc = p.geometry?.location;
      const distance = loc
        ? haversineDistance(latNum, lngNum, loc.lat, loc.lng)
        : undefined;
      allResults.push({
        place_id: p.place_id,
        name: p.name,
        vicinity: p.vicinity,
        rating: p.rating,
        user_ratings_total: p.user_ratings_total,
        types: p.types,
        photos: p.photos,
        geometry: p.geometry,
        distance,
      });
    }
  }

  const seen = new Set<string>();
  const unique = allResults.filter((p) => {
    if (seen.has(p.place_id)) return false;
    if ((p.rating ?? 0) <= minRating) return false;
    if (!isFoodAndDrinkPlace(p.types)) return false; // solo comida/bebida; excluir lodging, hotel, etc.
    seen.add(p.place_id);
    return true;
  });

  // Excluir cadenas conocidas (nombre contiene alguna de la lista, case-insensitive)
  const nameLower = (s: string) => (s ?? "").trim().toLowerCase();
  const isChainByName = (name: string) =>
    CHAINS_TO_EXCLUDE.some((chain) => nameLower(name).includes(chain));

  // Excluir lugares con más de 10k reseñas (indica cadena con volumen masivo)
  const underMaxReviews = (p: (typeof unique)[0]) =>
    (p.user_ratings_total ?? 0) <= MAX_REVIEWS_CHAIN;

  // Contar cuántas veces aparece cada nombre normalizado; excluir nombres que aparecen > MAX_SAME_NAME
  const nameCount = new Map<string, number>();
  for (const p of unique) {
    const n = nameLower(p.name);
    if (n) nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
  }
  const isRepeatedChainName = (name: string) => (nameCount.get(nameLower(name)) ?? 0) > MAX_SAME_NAME;

  const filtered = unique.filter(
    (p) =>
      !isChainByName(p.name) &&
      underMaxReviews(p) &&
      !isRepeatedChainName(p.name)
  );

  // Priorizar 50–5000 reseñas (lugar local con trayectoria) y ordenar por rating descendente
  const inPreferredRange = (p: (typeof filtered)[0]) => {
    const total = p.user_ratings_total ?? 0;
    return total >= MIN_REVIEWS_PREFERRED && total <= MAX_REVIEWS_PREFERRED;
  };
  filtered.sort((a, b) => {
    const aIn = inPreferredRange(a);
    const bIn = inPreferredRange(b);
    if (aIn !== bIn) return aIn ? -1 : 1; // los del rango preferido primero
    return (b.rating ?? 0) - (a.rating ?? 0); // luego por rating descendente
  });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const results = filtered.slice(0, 60).map((p) => {
    const photoRef = p.photos?.[0]?.photo_reference;
    const photo_url = photoRef && apiKey ? getPlacePhotoUrl(photoRef, 400) : undefined;
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
      distance_m: p.distance ? Math.round(p.distance) : null,
    };
  });

  return NextResponse.json({ results });
}
