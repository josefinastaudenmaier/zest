import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractChipsFromQuestions } from "@/lib/questionChips";

export const dynamic = "force-dynamic";

const LIMIT = 20;

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
  const pais = searchParams.get("pais") ?? "AR";
  const ciudad = searchParams.get("ciudad") ?? "";

  const supabase = createClient(url, key);
  let query = supabase
    .from("lugares")
    .select("id, nombre, direccion, ciudad, pais, google_maps_url, five_star_rating_published, tipo_comida, review_text_published, questions")
    .eq("pais", pais)
    .order("five_star_rating_published", { ascending: false, nullsFirst: false })
    .limit(LIMIT);

  if (ciudad.trim()) {
    query = query.ilike("ciudad", `%${ciudad.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const results = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const questions = r.questions as Array<{ question?: string; selected_option?: string }> | null | undefined;
    const chips = extractChipsFromQuestions(questions);
    const rating = r.five_star_rating_published as number | null;
    const lat = r.lat as number | null;
    const lng = r.lng as number | null;
    const tipoComida = (r.tipo_comida as string) ?? null;
    const googleMapsUrl = (r.google_maps_url as string) ?? null;
    const ciudadRes = (r.ciudad as string) ?? null;
    const paisRes = (r.pais as string) ?? null;
    return {
      place_id: r.id,
      name: r.nombre ?? "",
      vicinity: (r.direccion as string) ?? undefined,
      rating: rating ?? undefined,
      user_ratings_total: undefined,
      type: tipoComida ?? "Lugar",
      types: tipoComida ? [tipoComida] : undefined,
      photo_reference: null,
      photo_url: null,
      distance_m: null,
      geometry: lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
        ? { location: { lat, lng } }
        : undefined,
      chips,
      google_maps_url: googleMapsUrl ?? undefined,
      ciudad: ciudadRes ?? undefined,
      pais: paisRes ?? undefined,
    };
  });

  return NextResponse.json({ results });
}
