import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/** Reverse geocode: lat/lng → ciudad para mostrar por defecto en el selector. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl ?? new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
  }
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return NextResponse.json({ error: "Parámetros lat y lng requeridos" }, { status: 400 });
  }

  const latlng = `${lat},${lng}`;
  const apiUrl = `${GEOCODE_URL}?latlng=${encodeURIComponent(latlng)}&key=${key}&language=es`;
  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ city: null });
    }
    let city: string | null = null;
    for (const result of data.results) {
      for (const comp of result.address_components ?? []) {
        if (comp.types.includes("locality")) {
          city = comp.long_name?.trim() || null;
          break;
        }
      }
      if (city) break;
    }
    if (!city) {
      for (const result of data.results) {
        for (const comp of result.address_components ?? []) {
          if (comp.types.includes("administrative_area_level_1")) {
            city = comp.long_name?.trim() || null;
            break;
          }
        }
        if (city) break;
      }
    }
    return NextResponse.json({ city });
  } catch {
    return NextResponse.json({ city: null });
  }
}
