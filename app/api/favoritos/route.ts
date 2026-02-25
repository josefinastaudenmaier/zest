import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ favoritos: [] });
  }
  const { data, error } = await supabase
    .from("favoritos")
    .select("place_id, name, formatted_address, rating, photo_reference")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ favoritos: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const body = await request.json();
  const {
    place_id,
    name,
    formatted_address,
    rating,
    photo_reference,
  } = body as {
    place_id: string;
    name?: string;
    formatted_address?: string;
    rating?: number;
    photo_reference?: string;
  };
  if (!place_id) {
    return NextResponse.json(
      { error: "place_id requerido" },
      { status: 400 }
    );
  }
  const { error } = await supabase.from("favoritos").upsert(
    {
      user_id: user.id,
      place_id,
      name: name ?? null,
      formatted_address: formatted_address ?? null,
      rating: rating ?? null,
      photo_reference: photo_reference ?? null,
    },
    { onConflict: "user_id,place_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const place_id = searchParams.get("place_id");
  if (!place_id) {
    return NextResponse.json(
      { error: "place_id requerido" },
      { status: 400 }
    );
  }
  const { error } = await supabase
    .from("favoritos")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", place_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
