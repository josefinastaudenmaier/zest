/**
 * Excluye lugares que no son de comida (hoteles, ópticas, museos, alojamientos, etc.)
 * para no mostrarlos en recomendaciones ni búsqueda.
 */
const PALABRAS_EXCLUIDAS = [
  "óptica",
  "optica",
  "hotel",
  "suite",
  "museo",
  "tour",
  "subterránea",
  "subterranea",
  "alojamiento",
  "hospedaje",
  "hostel",
  "cabaña",
  "cabana",
  "bungalow",
  "lodge",
  "apart hotel",
  "resort",
  "hostal",
  "bed and breakfast",
  "b&b",
  "posada",
  "hostería",
  "hosteria",
];

export function esLugarDeComida(nombre: string): boolean {
  if (!nombre || typeof nombre !== "string") return false;
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return !PALABRAS_EXCLUIDAS.some((p) => n.includes(p.toLowerCase()));
}
