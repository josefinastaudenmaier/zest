import { NextRequest, NextResponse } from "next/server";
import type { PlaceResult } from "@/types/places";
import { isFoodAndDrinkPlace } from "@/lib/placeTypes";
import { getPlacePhotoUrl } from "@/lib/places";

const LEGACY_API = "https://maps.googleapis.com/maps/api/place";
const NEW_API = "https://places.googleapis.com/v1/places:searchText";

export const dynamic = "force-dynamic";

function jsonResponse(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type NewPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  regularOpeningHours?: { openNow?: boolean };
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  photos?: Array<{ name?: string }>;
};

function priceLevelToNumber(level?: string): number | undefined {
  if (!level) return undefined;
  switch (level) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    default:
      return undefined;
  }
}

function mapNewApiToResults(places: NewPlace[], key: string): PlaceResult[] {
  return places.map((p) => {
    const types: string[] = [];
    if (p.primaryType) types.push(p.primaryType);
    if (p.types) types.push(...p.types);
    const photoName = p.photos?.[0]?.name;
    const photoUrl =
      photoName && key
        ? `https://places.googleapis.com/v1/${photoName}/media?key=${encodeURIComponent(key)}&maxWidthPx=400`
        : undefined;
    return {
      place_id: p.id ?? "",
      name: p.displayName?.text ?? "",
      formatted_address: p.formattedAddress,
      rating: p.rating,
      user_ratings_total: p.userRatingCount,
      price_level: priceLevelToNumber(p.priceLevel),
      opening_hours: p.regularOpeningHours ? { open_now: p.regularOpeningHours.openNow } : undefined,
      photos: undefined,
      photoUrl,
      geometry: p.location
        ? { location: { lat: p.location.latitude ?? 0, lng: p.location.longitude ?? 0 } }
        : undefined,
      vicinity: p.formattedAddress,
      types: types.length ? types : undefined,
    };
  });
}

async function searchWithNewApi(
  textQuery: string,
  key: string
): Promise<{ results: PlaceResult[] } | { error: string }> {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.location",
    "places.regularOpeningHours",
    "places.priceLevel",
    "places.primaryType",
    "places.types",
    "places.photos",
  ].join(",");

  const res = await fetch(NEW_API, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({
      textQuery: `${textQuery} Buenos Aires Argentina`,
      languageCode: "es",
      regionCode: "AR",
      pageSize: 20,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = errText;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error?.message ?? errText;
    } catch {
      // use raw text
    }
    return { error: errMsg };
  }

  const data = (await res.json()) as { places?: NewPlace[] };
  const places = data.places ?? [];
  return { results: mapNewApiToResults(places, key) };
}

async function searchWithLegacyApi(
  textQuery: string,
  key: string
): Promise<{ results: PlaceResult[] } | { error: string }> {
  const url = `${LEGACY_API}/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${key}&language=es`;
  const res = await fetch(url, { cache: "no-store" });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    return { error: text.slice(0, 200) };
  }
  const data = (await res.json()) as { status?: string; error_message?: string; results?: unknown[] };
  const status = data.status;
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    return { error: data.error_message || String(status) };
  }
  const rawResults = (data.results || []) as Record<string, unknown>[];
  const results: PlaceResult[] = rawResults.map((p) => {
    const photos = p.photos as PlaceResult["photos"];
    const firstPhoto = Array.isArray(photos) ? photos[0] : undefined;
    const photoRef = firstPhoto?.photo_reference;
    const photoUrl = photoRef && key ? getPlacePhotoUrl(photoRef, 400) : undefined;
    return {
      place_id: p.place_id as string,
      name: p.name as string,
      formatted_address: p.formatted_address as string,
      rating: p.rating as number,
      user_ratings_total: p.user_ratings_total as number,
      price_level: p.price_level as number,
      opening_hours: p.opening_hours as { open_now?: boolean },
      photos,
      photoUrl,
      types: p.types as string[],
      geometry: p.geometry as PlaceResult["geometry"],
      vicinity: p.vicinity as string,
    };
  });
  return { results };
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl?.searchParams?.get("q") ?? null;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      return jsonResponse(
        { error: "Google Maps API key no configurada" },
        500
      );
    }
    if (!query?.trim()) {
      return jsonResponse({ error: "Parámetro 'q' requerido" }, 400);
    }
    const textQuery = query.trim();

    let out = await searchWithNewApi(textQuery, key);
    if ("error" in out) {
      out = await searchWithLegacyApi(`${textQuery} Buenos Aires Argentina`, key);
    }

    if ("error" in out) {
      const rawMessage = out.error;
      const isBillingError = /billing|facturación|REQUEST_DENIED|403|API key/i.test(rawMessage);
      const errorMessage = isBillingError
        ? "Para usar la búsqueda, activá la facturación en tu proyecto de Google Cloud (incluye crédito gratis). Habilitá 'Places API' o 'Places API (New)'. Más info: https://console.cloud.google.com/project/_/billing/enable"
        : rawMessage;
      return jsonResponse({ error: errorMessage }, 400);
    }

    // Solo lugares de comida y bebida; excluir lodging, hotel, hospital, pharmacy, store, supermarket, gas_station
    const filtered = out.results.filter((p) => isFoodAndDrinkPlace(p.types));
    return jsonResponse({ results: filtered }, 200);
  } catch (e) {
    console.error("Error en /api/search:", e);
    return jsonResponse(
      { error: "Error al buscar lugares. Revisá la consola del servidor." },
      500
    );
  }
}
