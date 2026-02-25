import { NextRequest, NextResponse } from "next/server";
import { extractChipsFromReviews } from "@/lib/reviewChips";

/**
 * Chips en cards de restaurantes: se obtienen solo de reseñas de Google Places.
 * La lógica estricta está en lib/reviewChips.ts:
 * - Mínimo 3 reseñas por lugar; si hay menos, no se muestran chips.
 * - Cada chip requiere que la palabra clave aparezca en ≥2 reseñas distintas.
 * - Solo se usa texto literal de reseñas; no nombre del lugar ni categoría.
 * No modificar sin respetar esas reglas.
 */

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";
const MAX_PLACES = 15;

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Google Maps API key no configurada" },
      { status: 500 }
    );
  }

  let body: { placeIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON inválido" },
      { status: 400 }
    );
  }

  const placeIds = Array.isArray(body.placeIds)
    ? (body.placeIds as string[]).filter((id) => typeof id === "string").slice(0, MAX_PLACES)
    : [];

  if (placeIds.length === 0) {
    return NextResponse.json({ chipsByPlaceId: {} });
  }

  const chipsByPlaceId: Record<string, Array<{ label: string; icon: string }>> = {};

  await Promise.all(
    placeIds.map(async (placeId) => {
      try {
        const url = `${GOOGLE_API}/details/json?place_id=${encodeURIComponent(placeId)}&key=${key}&language=es&fields=place_id,reviews`;
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json()) as { status?: string; result?: { reviews?: Array<{ text?: string }> } };
        if (data.status !== "OK" || !data.result?.reviews?.length) {
          chipsByPlaceId[placeId] = [];
          return;
        }
        const chips = extractChipsFromReviews(data.result.reviews);
        chipsByPlaceId[placeId] = chips;
      } catch {
        chipsByPlaceId[placeId] = [];
      }
    })
  );

  return NextResponse.json({ chipsByPlaceId });
}
