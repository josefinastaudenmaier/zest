import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCanonicalCityMap, canonicalizeCity, extractCityFromAddress } from "@/lib/city";
import { esLugarDeComida } from "@/lib/excludeNonFood";

export const dynamic = "force-dynamic";

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
  const pais = searchParams.get("pais") ?? "";

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("lugares")
    .select("nombre, direccion, pais, lat, lng")
    .limit(2000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const rows = (data ?? []).filter((row) => {
    const r = row as Record<string, unknown>;
    if (!esLugarDeComida(String(r.nombre ?? ""))) return false;
    if (!pais.trim()) return true;
    return String(r.pais ?? "").toUpperCase() === pais.trim().toUpperCase();
  });

  const canonicalMap = buildCanonicalCityMap(
    rows.map((r) => {
      const rr = r as Record<string, unknown>;
      return {
        direccion: (rr.direccion as string | null) ?? null,
        lat: rr.lat as number | null,
        lng: rr.lng as number | null,
      };
    }),
    50
  );

  const seen = new Set<string>();
  const ciudades: string[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const rawCity = extractCityFromAddress((r.direccion as string | null) ?? null);
    const city = canonicalizeCity(rawCity, canonicalMap);
    if (city && !seen.has(city)) {
      seen.add(city);
      ciudades.push(city);
    }
  }
  ciudades.sort((a, b) => a.localeCompare(b, "es"));
  return NextResponse.json({ ciudades });
}
