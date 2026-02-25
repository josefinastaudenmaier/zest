import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada" },
      { status: 500 }
    );
  }

  let body: { resenas?: string[]; busqueda?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 }
    );
  }

  const resenas = Array.isArray(body.resenas) ? body.resenas : [];
  const busqueda = typeof body.busqueda === "string" ? body.busqueda.trim() : "";

  if (resenas.length === 0) {
    return NextResponse.json({ resumen: null });
  }

  const reseñasBlock = resenas.map((t, i) => `[${i + 1}] ${t}`).join("\n\n");

  const userPrompt = busqueda
    ? `El usuario buscó: "${busqueda}".

Estas son reseñas de un lugar:

${reseñasBlock}

Tu tarea:
1. Filtra las reseñas más relevantes según lo que buscó el usuario (prioriza las que mencionen temas relacionados con su búsqueda).
2. A partir de esas reseñas, genera un resumen en español de 2 a 3 oraciones, en tono natural y útil, que responda a lo que el usuario quiere saber.

Responde ÚNICAMENTE con el resumen, sin introducción ni títulos.`
    : `Estas son reseñas de un lugar:

${reseñasBlock}

Genera un resumen en español de 2 a 3 oraciones, en tono natural y útil, sobre lo que dicen los visitantes (ambiente, calidad, experiencia). Responde ÚNICAMENTE con el resumen, sin introducción ni títulos.`;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic error:", res.status, err);
      return NextResponse.json(
        { error: "Error al generar resumen" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.type === "text" ? data.content[0].text?.trim() : null;
    return NextResponse.json({ resumen: text ?? null });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al generar resumen" },
      { status: 500 }
    );
  }
}
