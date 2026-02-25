import { NextRequest, NextResponse } from "next/server";

const GOOGLE_API = "https://maps.googleapis.com/maps/api/place";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

type Review = { author_name: string; rating: number; text: string; relative_time_description: string };

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos (equivalente a \p{Diacritic})
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "que", "es", "por", "para", "con", "no", "se", "lo", "como", "muy", "pero", "sus", "le", "ya", "o", "fue", "este", "ha", "si", "sí", "porque", "esta", "entre", "cuando", "más", "muy", "sin", "sobre", "también", "me", "hasta", "hay", "donde", "han", "quien", "desde", "todo", "nos", "durante", "estados", "uno", "les", "ni", "contra", "otros", "ese", "eso", "ante", "ellos", "e", "esto", "mi", "antes", "algunos", "qué", "un", "su", "te", "ti", "yo", "tu", "tus",
]);

function relevanceScore(reviewText: string, query: string): number {
  if (!query.trim()) return 1;
  const queryWords = tokenize(query).filter((w) => !STOPWORDS.has(w));
  if (queryWords.length === 0) return 1;
  const reviewLower = reviewText.toLowerCase();
  let hits = 0;
  for (const w of queryWords) {
    if (reviewLower.includes(w)) hits++;
  }
  return hits / queryWords.length;
}

function selectRelevantReviews(reviews: Review[], query: string, maxReviews: number): Review[] {
  if (!reviews.length) return [];
  if (!query.trim()) return reviews.slice(0, maxReviews);
  const withScore = reviews.map((r) => ({ review: r, score: relevanceScore(r.text, query) }));
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, maxReviews).map((x) => x.review);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ placeId: string }> }
) {
  const { placeId } = await context.params;
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!googleKey) {
    return NextResponse.json(
      { error: "Google Maps API key no configurada" },
      { status: 500 }
    );
  }
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada" },
      { status: 500 }
    );
  }

  const placeUrl = `${GOOGLE_API}/details/json?place_id=${encodeURIComponent(placeId)}&key=${googleKey}&language=es&fields=reviews`;
  let reviews: Review[] = [];
  try {
    const placeRes = await fetch(placeUrl);
    const placeData = await placeRes.json();
    if (placeData.status === "OK" && Array.isArray(placeData.result?.reviews)) {
      reviews = placeData.result.reviews;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al obtener reseñas" },
      { status: 500 }
    );
  }

  if (reviews.length === 0) {
    return NextResponse.json({ summary: null });
  }

  const selected = selectRelevantReviews(reviews, q, 10);
  const reviewsBlock = selected
    .map((r) => `[${r.rating}★] ${r.text}`)
    .join("\n\n");

  const userPrompt = q.trim()
    ? `El usuario buscó: "${q}".\n\nReseñas del lugar (las más relevantes para su búsqueda):\n\n${reviewsBlock}\n\nGenera un resumen en español de 2 a 3 oraciones que responda a lo que el usuario buscó, basado en lo que dicen estas reseñas. Escribe solo el resumen, sin introducción ni títulos.`
    : `Reseñas del lugar:\n\n${reviewsBlock}\n\nGenera un resumen en español de 2 a 3 oraciones sobre lo que dicen los visitantes (ambiente, calidad, experiencia). Escribe solo el resumen, sin introducción ni títulos.`;

  try {
    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, err);
      return NextResponse.json(
        { error: "Error al generar resumen" },
        { status: 502 }
      );
    }

    const data = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.type === "text" ? data.content[0].text?.trim() : null;
    return NextResponse.json({ summary: text ?? null });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al generar resumen" },
      { status: 500 }
    );
  }
}
