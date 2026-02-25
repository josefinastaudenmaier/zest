import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PlaceDetail } from "@/types/places";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json(
      { error: "placeId requerido" },
      { status: 400 }
    );
  }

  if (!UUID_REGEX.test(placeId)) {
    return NextResponse.json(
      { error: "ID de lugar no válido (se espera un ID de la base de datos)" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase no configurado" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key);
  const { data: row, error } = await supabase
    .from("lugares")
    .select("*")
    .eq("id", placeId)
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Lugar no encontrado" },
      { status: 404 }
    );
  }

  const r = row as Record<string, unknown>;
  const reviewText = (r.review_text_published as string) ?? "";
  const place: PlaceDetail = {
    place_id: r.id as string,
    name: (r.nombre as string) ?? "",
    formatted_address: (r.direccion as string) ?? "",
    vicinity: (r.direccion as string) ?? "",
    url: (r.google_maps_url as string) ?? undefined,
    rating: (r.five_star_rating_published as number) ?? undefined,
    user_ratings_total: undefined,
    geometry:
      r.lat != null && r.lng != null
        ? { location: { lat: Number(r.lat), lng: Number(r.lng) } }
        : undefined,
    types: (r.tipo_comida as string) ? [(r.tipo_comida as string)] : undefined,
    reviews: reviewText
      ? [
          {
            author_name: "Reseña",
            rating: (r.five_star_rating_published as number) ?? 0,
            text: reviewText,
            relative_time_description: "",
          },
        ]
      : undefined,
  };

  return NextResponse.json(place);
}
