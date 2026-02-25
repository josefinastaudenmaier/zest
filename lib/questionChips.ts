/**
 * Chips para cards a partir del array "questions" de Supabase lugares.
 * Se muestran: tipo de comida, nivel de ruido, si se recomienda reservar.
 */

export type QuestionChip = { label: string; icon: string };

const RESERVAS_KEYS = ["reservas", "reserva recomendada"];

function normalizeQuestion(q: string): string {
  return (q ?? "").trim().toLowerCase();
}

export function extractChipsFromQuestions(
  questions: Array<{ question?: string; selected_option?: string }> | null | undefined
): QuestionChip[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const chips: QuestionChip[] = [];
  for (const item of questions) {
    const q = normalizeQuestion(item.question ?? "");
    const opt = (item.selected_option ?? "").trim();
    if (!opt) continue;
    if (q.includes("tipo") && q.includes("comida")) {
      chips.push({ label: opt, icon: "coffee" });
    } else if (q.includes("nivel") && q.includes("ruido")) {
      chips.push({ label: `Ruido: ${opt}`, icon: opt.toLowerCase().includes("bajo") ? "tranquilo" : "movido" });
    } else if (RESERVAS_KEYS.some((k) => q.includes(k))) {
      chips.push({ label: "Se recomienda reservar", icon: "calendar" });
    }
  }
  return chips.slice(0, 5);
}
