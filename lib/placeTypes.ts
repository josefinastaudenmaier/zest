/**
 * Filtro estricto para mostrar solo lugares de comida y bebida en /buscar
 * (sección "Abiertos ahora" y resultados de búsqueda).
 * No mostrar nada que no tenga al menos un tipo permitido;
 * excluir siempre que tenga algún tipo prohibido.
 */

/** Tipos de Google Places que se consideran comida/bebida. El lugar debe tener al menos uno. */
export const ALLOWED_PLACE_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "night_club",
] as const;

/** Tipos que excluyen el lugar aunque también tenga tipos permitidos (ej. hotel con restaurante). */
export const EXCLUDED_PLACE_TYPES = [
  "lodging",
  "hotel",
  "hospital",
  "pharmacy",
  "store",
  "supermarket",
  "gas_station",
] as const;

const allowedSet = new Set(ALLOWED_PLACE_TYPES.map((t) => t.toLowerCase()));
const excludedSet = new Set(EXCLUDED_PLACE_TYPES.map((t) => t.toLowerCase()));

function normalizeType(t: string): string {
  return (t ?? "").trim().toLowerCase();
}

function typeMatchesSet(normalizedType: string, set: Set<string>): boolean {
  if (set.has(normalizedType)) return true;
  // Por si la API devuelve URI o formato largo (ej. schema.org/Restaurant)
  for (const key of Array.from(set)) {
    if (normalizedType.includes(key)) return true;
  }
  return false;
}

/**
 * true solo si el lugar tiene al menos un tipo permitido y ninguno de los excluidos.
 * Si types es vacío o undefined, devuelve false.
 */
export function isFoodAndDrinkPlace(types: string[] | undefined): boolean {
  if (!types?.length) return false;
  const normalized = types.map(normalizeType);
  const hasAllowed = normalized.some((t) => typeMatchesSet(t, allowedSet));
  const hasExcluded = normalized.some((t) => typeMatchesSet(t, excludedSet));
  return hasAllowed && !hasExcluded;
}
