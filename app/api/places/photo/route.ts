import { NextRequest, NextResponse } from "next/server";
import { getPlacePhotoUrl } from "@/lib/places";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";
export const dynamic = "force-dynamic";

/** Una sola llamada a Places API para obtener la foto del lugar por nombre (y opcional ubicación). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl ?? new URL(request.url);
  const name = url.searchParams.get("name")?.trim();
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
  }
  if (!name) {
    return NextResponse.json({ error: "Parámetro name requerido" }, { status: 400 });
  }

  const location =
    lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
      ? `${lat},${lng}`
      : undefined;

  const query = encodeURIComponent(name);
  const locationBias = location ? `&location=${location}&radius=500` : "";
  const apiUrl = `${GOOGLE_API}/textsearch/json?query=${query}${locationBias}&key=${key}&language=es`;
  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = (await res.json()) as { status?: string; results?: Array<{ photos?: Array<{ photo_reference: string }> }> };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ photo_url: null });
    }
    const first = data.results?.[0];
    const photoRef = first?.photos?.[0]?.photo_reference;
    const photo_url = photoRef ? getPlacePhotoUrl(photoRef, 400) : null;
    return NextResponse.json({ photo_url });
  } catch {
    return NextResponse.json({ photo_url: null });
  }
}
