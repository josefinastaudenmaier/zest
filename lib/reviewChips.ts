/**
 * Extrae chips (atributos) para las cards de restaurantes a partir SOLO del
 * texto literal de las reseñas de Google Places.
 *
 * REGLAS ESTRICTAS (no inventar información):
 * 1. Un chip solo se muestra si la palabra clave aparece en al menos 2 reseñas
 *    DISTINTAS del lugar (no basta con una sola mención).
 * 2. Si Google Places devuelve menos de 3 reseñas para un lugar, no mostrar
 *    ningún chip (poca evidencia).
 * 3. No inferir atributos del nombre del lugar ni de su categoría; solo del
 *    texto literal de las reseñas.
 * 4. Si no hay evidencia suficiente, devolver [] (card sin chips).
 *
 * No modificar esta lógica sin asegurar que se mantengan estas reglas.
 */

export type ReviewChip = { label: string; icon: string };

const MAX_CHIPS = 3;

type Rule = {
  keywords: string[];
  label: string;
  icon: string;
};

const RULES: Rule[] = [
  {
    keywords: ["wifi", "internet", "trabajo", "trabajar", "conexión", "conexion"],
    label: "buen wifi",
    icon: "wifi",
  },
  {
    keywords: ["reservar", "reserva", "reservación", "reservacion", "lleno", "espera", "esperar", "sin reserva"],
    label: "se recomienda reservar",
    icon: "calendar",
  },
  {
    keywords: ["terraza", "afuera", "exterior", "al aire libre", "parque", "jardín", "jardin"],
    label: "terraza",
    icon: "terraza",
  },
  {
    keywords: ["tranquilo", "tranquila", "silencioso", "íntimo", "intimo", "calmado", "relajado"],
    label: "ambiente tranquilo",
    icon: "tranquilo",
  },
  {
    keywords: ["ruidoso", "música", "musica", "animado", "animada", "vivo", "fiesta", "ambiente movido"],
    label: "ambiente movido",
    icon: "movido",
  },
  {
    keywords: ["económico", "economico", "barato", "barata", "accesible", "buen precio", "rico y barato"],
    label: "precio accesible",
    icon: "precio",
  },
  {
    keywords: ["caro", "cara", "precio elevado", "costoso", "carísimo", "carisimo"],
    label: "precio elevado",
    icon: "precio",
  },
  {
    keywords: ["perro", "perros", "mascota", "mascotas", "pet friendly", "pet-friendly", "dog friendly"],
    label: "pet friendly",
    icon: "pet",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Cuenta en cuántas reseñas distintas aparece al menos una keyword de la regla.
 */
function countReviewsWithKeyword(
  reviews: Array<{ text?: string }>,
  keywords: string[]
): number {
  const normalizedKeywords = keywords.map((k) => normalize(k));
  let count = 0;
  for (const review of reviews) {
    const text = normalize(review.text ?? "");
    if (!text.trim()) continue;
    const hasMatch = normalizedKeywords.some((kw) => text.includes(kw));
    if (hasMatch) count++;
  }
  return count;
}

/**
 * Dado un array de reseñas (objeto con .text), extrae chips SOLO si:
 * - Hay al menos 3 reseñas (si hay menos, devuelve []).
 * - Cada chip se incluye solo si su palabra clave aparece en ≥2 reseñas distintas.
 * Solo se usa el texto literal de las reseñas; no se usa nombre del lugar ni categoría.
 */
export function extractChipsFromReviews(
  reviews: Array<{ text?: string }> | undefined
): ReviewChip[] {
  if (!reviews?.length) return [];

  const list = reviews.filter((r) => (r.text ?? "").trim().length > 0);
  if (list.length < 3) return [];

  const chips: ReviewChip[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (chips.length >= MAX_CHIPS) break;
    const reviewCount = countReviewsWithKeyword(list, rule.keywords);
    if (reviewCount >= 2 && !seen.has(rule.label)) {
      seen.add(rule.label);
      chips.push({ label: rule.label, icon: rule.icon });
    }
  }

  return chips;
}

/**
 * Para lugares con una sola reseña (ej. resena_personal / review_text_published).
 * Si el texto contiene alguna keyword de una regla, se agrega el chip (máx. MAX_CHIPS).
 */
export function extractChipsFromSingleReview(
  text: string | null | undefined
): ReviewChip[] {
  if (!text?.trim()) return [];
  const normalized = normalize(text);
  const chips: ReviewChip[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    if (chips.length >= MAX_CHIPS) break;
    const hasMatch = rule.keywords.some((kw) =>
      normalized.includes(normalize(kw))
    );
    if (hasMatch && !seen.has(rule.label)) {
      seen.add(rule.label);
      chips.push({ label: rule.label, icon: rule.icon });
    }
  }
  return chips;
}
