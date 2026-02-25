import { NextResponse } from "next/server";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";

// Centro de Buenos Aires
const BA_LAT = -34.6037;
const BA_LNG = -58.3816;

export const dynamic = "force-dynamic";

function mapType(types: string[] | undefined): string {
  if (!types?.length) return "Lugar";
  if (types.some((t) => t.includes("restaurant"))) return "Restaurante";
  if (types.some((t) => t.includes("bar"))) return "Bar";
  if (types.some((t) => t.includes("cafe"))) return "Café";
  return "Lugar";
}

export async function GET() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Google Maps API key no configurada" },
      { status: 500 }
    );
  }

  const location = `${BA_LAT},${BA_LNG}`;
  const radius = 5000;
  const types = ["restaurant", "bar", "cafe"];
  const allResults: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    photos?: Array<{ photo_reference: string }>;
  }> = [];

  for (const type of types) {
    const url = `${GOOGLE_API}/nearbysearch/json?location=${location}&radius=${radius}&type=${type}&key=${key}&language=es`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") continue;
    const list = (data.results || []).filter(
      (p: { rating?: number }) => (p.rating ?? 0) >= 4.5
    );
    allResults.push(...list);
  }

  const seen = new Set<string>();
  const unique = allResults.filter((p) => {
    if (seen.has(p.place_id)) return false;
    seen.add(p.place_id);
    return true;
  });
  unique.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const results = unique.slice(0, 12).map((p) => ({
    place_id: p.place_id,
    name: p.name,
    vicinity: p.vicinity,
    rating: p.rating,
    user_ratings_total: p.user_ratings_total,
    type: mapType(p.types),
    photo_reference: p.photos?.[0]?.photo_reference,
  }));

  return NextResponse.json({ results });
}
