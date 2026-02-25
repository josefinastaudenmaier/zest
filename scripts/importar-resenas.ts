/**
 * Script para importar reseñas desde Reseñas.json a la tabla lugares de Supabase.
 *
 * Uso:
 *   1. Crear la tabla: ejecutar supabase/lugares.sql en el SQL Editor de Supabase.
 *   2. Configurar .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY).
 *   3. npx tsx scripts/importar-resenas.ts
 *
 * O con variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/importar-resenas.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local si existe
function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch {
    // .env.local opcional
  }
}

const PALABRAS_EXCLUIDAS = [
  "óptica",
  "optica",
  "hotel",
  "suite",
  "museo",
  "tour",
  "subterránea",
  "subterranea",
];

function esLugarDeComida(nombre: string): boolean {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return !PALABRAS_EXCLUIDAS.some((p) => n.includes(p.toLowerCase()));
}

function extraerCiudad(direccion: string | undefined): string | null {
  if (!direccion || !direccion.trim()) return null;
  const partes = direccion.split(",").map((s) => s.trim());
  if (partes.length < 2) return null;
  return partes[partes.length - 2] ?? null;
}

type GeoJSONFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    date?: string;
    five_star_rating_published?: number;
    google_maps_url?: string;
    location?: {
      address?: string;
      country_code?: string;
      name?: string;
    };
    questions?: Array<{ question: string; selected_option?: string; rating?: number }>;
    review_text_published?: string;
  };
};

type GeoJSONCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

type FilaLugar = {
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  pais: string | null;
  lat: number | null;
  lng: number | null;
  google_maps_url: string | null;
  five_star_rating_published: number | null;
  tipo_comida: string | null;
  questions: unknown;
  review_text_published: string | null;
  fecha_resena: string | null;
};

function featureToRow(f: GeoJSONFeature): FilaLugar | null {
  const loc = f.properties?.location;
  const name = loc?.name?.trim();
  if (!name) return null;

  const [lng, lat] = f.geometry?.coordinates ?? [null, null];
  const address = loc?.address?.trim() ?? null;
  const countryCode = loc?.country_code?.trim() ?? null;
  const questions = f.properties?.questions ?? [];
  const tipoComida =
    (Array.isArray(questions) &&
      (questions as Array<{ question: string; selected_option?: string }>).find(
        (q) => q.question === "Tipo de comida"
      )?.selected_option?.trim()) ?? null;

  return {
    nombre: name,
    direccion: address ?? null,
    ciudad: extraerCiudad(address ?? undefined),
    pais: countryCode ?? null,
    lat: typeof lat === "number" && !Number.isNaN(lat) ? lat : null,
    lng: typeof lng === "number" && !Number.isNaN(lng) ? lng : null,
    google_maps_url: f.properties?.google_maps_url?.trim() ?? null,
    five_star_rating_published:
      typeof f.properties?.five_star_rating_published === "number"
        ? f.properties.five_star_rating_published
        : null,
    tipo_comida: tipoComida ?? null,
    questions: questions,
    review_text_published: f.properties?.review_text_published?.trim() ?? null,
    fecha_resena: f.properties?.date ?? null,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY en el entorno.");
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(url, key);

  const jsonPath = path.join(process.cwd(), "Reseñas.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("No se encontró Reseñas.json en la raíz del proyecto.");
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  let data: GeoJSONCollection;
  try {
    data = JSON.parse(raw) as GeoJSONCollection;
  } catch (e) {
    console.error("Error al parsear Reseñas.json:", e);
    process.exit(1);
  }

  const features = Array.isArray(data?.features) ? data.features : [];
  const saltados: string[] = [];
  const filas: FilaLugar[] = [];

  for (const f of features) {
    const name = f.properties?.location?.name?.trim();
    if (!name) {
      saltados.push("(sin nombre)");
      continue;
    }
    if (!esLugarDeComida(name)) {
      saltados.push(name);
      continue;
    }
    const row = featureToRow(f);
    if (row) filas.push(row);
  }

  if (filas.length === 0) {
    console.log("No hay lugares para importar después del filtro.");
    console.log("Saltados:", saltados.length, saltados.slice(0, 20).join(", "), saltados.length > 20 ? "..." : "");
    return;
  }

  const BATCH = 80;
  for (let i = 0; i < filas.length; i += BATCH) {
    const batch = filas.slice(i, i + BATCH);
    const { error } = await supabase.from("lugares").insert(batch);
    if (error) {
      console.error("Error al insertar en Supabase (lote " + (Math.floor(i / BATCH) + 1) + "):", error.message);
      process.exit(1);
    }
  }

  console.log("Importados:", filas.length);
  console.log("Saltados:", saltados.length);
  if (saltados.length > 0) {
    console.log("Nombres saltados:", saltados.join(", "));
  }
}

main();
