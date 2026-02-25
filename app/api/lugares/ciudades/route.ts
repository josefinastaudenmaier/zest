import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Quita código postal del inicio (ej. "C1414 Cdad..." o "C1429 C1429DUG Cdad..." -> "Cdad...") */
function normalizeCiudad(ciudad: string): string {
  const t = ciudad.trim();
  return t.replace(/^C\d{4}(?:\s+[A-Z0-9]+)*\s+/, "").trim() || t;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase no configurado" },
      { status: 500 }
    );
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("lugares")
    .select("ciudad, pais")
    .not("ciudad", "is", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const seen = new Set<string>();
  const ciudades: string[] = [];
  for (const row of data ?? []) {
    const c = (row.ciudad as string)?.trim();
    if (!c) continue;
    const normalized = normalizeCiudad(c);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      ciudades.push(normalized);
    }
  }
  ciudades.sort((a, b) => a.localeCompare(b, "es"));
  return NextResponse.json({ ciudades });
}
