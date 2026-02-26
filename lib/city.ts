export function normalizeCityLabel(city: string): string {
  const raw = city.trim();
  if (!raw) return "";

  // Unificar variantes de Ciudad Autónoma de Buenos Aires.
  if (/(^|\b)(cdad\.?|ciudad)\s+aut[oó]noma\s+de\s+buenos\s+aires(\b|$)/i.test(raw)) {
    return "CABA";
  }

  // Regla pedida: eliminar cualquier palabra que contenga números
  // Ej: "1100-213 Lisboa" -> "Lisboa", "London EC2A 4PY" -> "London"
  const cleaned = raw
    .split(/\s+/)
    .filter((token) => token && !/\d/.test(token))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/^buenos\s+aires$/i.test(cleaned)) {
    return "CABA";
  }

  return cleaned;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type CityPoint = { city: string; lat: number; lng: number; count: number };

function buildUnionFind(n: number): { parent: number[]; find: (x: number) => number; union: (a: number, b: number) => void } {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  return { parent, find, union };
}

export function buildCanonicalCityMap(
  rows: Array<{ direccion?: string | null; lat?: number | null; lng?: number | null }>,
  radiusKm = 50
): Map<string, string> {
  const stats = new Map<string, { count: number; latSum: number; lngSum: number; coordCount: number }>();
  for (const row of rows) {
    const city = extractCityFromAddress(row.direccion ?? null);
    if (!city) continue;
    const entry = stats.get(city) ?? { count: 0, latSum: 0, lngSum: 0, coordCount: 0 };
    entry.count += 1;
    const lat = row.lat;
    const lng = row.lng;
    if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      entry.latSum += lat;
      entry.lngSum += lng;
      entry.coordCount += 1;
    }
    stats.set(city, entry);
  }

  const withCoords: CityPoint[] = [];
  const withoutCoords: Array<{ city: string; count: number }> = [];
  Array.from(stats.entries()).forEach(([city, s]) => {
    if (s.coordCount > 0) {
      withCoords.push({
        city,
        lat: s.latSum / s.coordCount,
        lng: s.lngSum / s.coordCount,
        count: s.count,
      });
    } else {
      withoutCoords.push({ city, count: s.count });
    }
  });

  const map = new Map<string, string>();
  if (withCoords.length > 0) {
    const uf = buildUnionFind(withCoords.length);
    for (let i = 0; i < withCoords.length; i += 1) {
      for (let j = i + 1; j < withCoords.length; j += 1) {
        const a = withCoords[i];
        const b = withCoords[j];
        if (haversineKm(a.lat, a.lng, b.lat, b.lng) <= radiusKm) {
          uf.union(i, j);
        }
      }
    }

    const clusters = new Map<number, CityPoint[]>();
    withCoords.forEach((c, idx) => {
      const root = uf.find(idx);
      const list = clusters.get(root) ?? [];
      list.push(c);
      clusters.set(root, list);
    });

    clusters.forEach((list) => {
      const canonical = [...list].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count; // ciudad "más grande" = más lugares
        return a.city.localeCompare(b.city, "es");
      })[0].city;
      list.forEach((c) => map.set(c.city, canonical));
    });
  }

  withoutCoords.forEach((c) => map.set(c.city, c.city));
  return map;
}

export function canonicalizeCity(city: string | null | undefined, canonicalMap: Map<string, string>): string | null {
  if (!city) return null;
  return canonicalMap.get(city) ?? city;
}

/**
 * Extrae ciudad desde direccion formateada.
 * Preferimos direccion porque la columna `ciudad` puede haber quedado contaminada
 * en importaciones viejas (provincia/códigos).
 */
export function extractCityFromAddress(address?: string | null): string | null {
  if (!address || !address.trim()) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  // Default: penúltimo segmento (antes de país)
  let candidate = parts[parts.length - 2];

  // Si hay provincia explícita, usar el segmento anterior
  if (/^provincia de /i.test(candidate) && parts.length >= 3) {
    candidate = parts[parts.length - 3];
  } else if (parts.length >= 4) {
    // Caso típico: "... , <postal+ciudad>, <provincia>, <país>"
    const prev = parts[parts.length - 3];
    const candidateLooksProvinceLike =
      !/^(cdad\.?|ciudad)\b/i.test(candidate) &&
      /^[A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,3}$/.test(candidate);
    if (/^(?:[A-Z]\d{4}[A-Z0-9]*|\d{4,5})\b/i.test(prev) && candidateLooksProvinceLike) {
      candidate = prev;
    }
  }

  const normalized = normalizeCityLabel(candidate);
  return normalized || null;
}
