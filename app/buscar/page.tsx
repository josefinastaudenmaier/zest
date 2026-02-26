"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { BuscarCard } from "@/components/BuscarCard";
import type { PlaceResult } from "@/types/places";

const ROTATING_PLACEHOLDERS = [
  "cafes con buen wifi",
  "brunch en palermo",
  "almorzar pet friendly",
  "hamburguesa viral",
  "cena veggie en nuñez",
];

function normalizeCityForMatch(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!base) return "";
  const isCabaAlias =
    base === "caba" ||
    base === "buenos aires" ||
    base === "capital federal" ||
    base === "ciudad autonoma de buenos aires" ||
    (base.includes("buenos aires") && (base.includes("ciudad") || base.includes("autonoma") || base.includes("capital")));

  if (isCabaAlias) {
    return "caba";
  }
  return base;
}

function resolveCityFromList(detected: string, cityList: string[]): string | null {
  const normalizedDetected = normalizeCityForMatch(detected);
  if (!normalizedDetected) return null;

  const exact = cityList.find((c) => normalizeCityForMatch(c) === normalizedDetected);
  if (exact) return exact;

  const includes = cityList.find((c) => {
    const normalizedCity = normalizeCityForMatch(c);
    return normalizedCity.includes(normalizedDetected) || normalizedDetected.includes(normalizedCity);
  });
  return includes ?? null;
}

function formatTipoComidaLabel(tipoComida?: string | null): string {
  const raw = (tipoComida ?? "").trim();
  if (!raw) return "LUGAR";
  return raw.replace(/_/g, " ").toUpperCase();
}

// --- Filtros: definición y lógica ---

const PRECIO_CHIPS = ["Económico", "Precio medio", "Premium"] as const;
const AMBIENTE_CHIPS = ["Tranquilo", "Movido", "Ideal para trabajar", "Romántico", "Familiar"] as const;
const TIPO_COMIDA_CHIPS = ["Desayuno", "Brunch", "Almuerzo", "Merienda", "Cena", "Café"] as const;
const CALIFICACION_CHIPS = ["4.5+", "4.0+", "3.5+"] as const;
const ESPACIO_CHIPS = ["Salón", "Terraza", "Vereda", "Barra", "Jardín", "Patio", "Comedor", "Interior"] as const;

const ETNIA_CHIPS = [
  "Japonesa",
  "Americana",
  "Argentina",
  "Italiana",
  "Mexicana",
  "China",
  "Peruana",
  "Española",
  "Árabe",
  "India",
  "Coreana",
  "Thai",
  "Vietnamita",
  "Francesa",
] as const;

const ETNIA_KEYWORDS: Record<string, string[]> = {
  Japonesa: ["japonés", "japonesa", "japanese", "sushi", "ramen", "sashimi", "nikkei", "tempura"],
  Americana: ["americano", "americana", "american", "burger", "hamburguesa", "bbq", "barbacoa", "steakhouse"],
  Argentina: ["parrilla", "asado", "argentino", "argentina", "empanadas", "choripan", "bife", "tango"],
  Italiana: ["italiano", "italiana", "italian", "pasta", "pizzeria", "trattoria", "ristorante", "pizza"],
  Mexicana: ["mexicano", "mexicana", "mexican", "tacos", "taquería", "taqueria", "burrito", "tex-mex"],
  China: ["chino", "china", "chinese", "wok", "dim sum", "cantonesa", "sichuan"],
  Peruana: ["peruano", "peruana", "peruvian", "ceviche", "nikkei", "comida peruana"],
  Española: ["español", "española", "spanish", "tapas", "paella", "iberico"],
  Árabe: ["árabe", "arabe", "arab", "libanés", "kebab", "falafel", "hummus", "medio oriente"],
  India: ["indio", "india", "indian", "curry", "tandoori", "masala"],
  Coreana: ["coreano", "coreana", "korean", "korean barbecue", "kimchi", "bibimbap"],
  Thai: ["tailandés", "tailandesa", "thai", "pad thai", "curry tailandés"],
  Vietnamita: ["vietnamita", "vietnamese", "pho", "banh mi"],
  Francesa: ["francés", "francesa", "french", "bistro", "brasserie", "creperie"],
};

const ETNIA_TYPES: Record<string, string[]> = {
  Japonesa: ["japanese_restaurant", "sushi_restaurant"],
  Americana: ["american_restaurant", "hamburger_restaurant"],
  Argentina: [],
  Italiana: ["italian_restaurant", "pizza_restaurant"],
  Mexicana: ["mexican_restaurant"],
  China: ["chinese_restaurant"],
  Peruana: [],
  Española: [],
  Árabe: ["middle_eastern_restaurant"],
  India: ["indian_restaurant"],
  Coreana: ["korean_restaurant"],
  Thai: ["thai_restaurant"],
  Vietnamita: ["vietnamese_restaurant"],
  Francesa: ["french_restaurant"],
};

const AMBIENTE_KEYWORDS: Record<string, string[]> = {
  Tranquilo: ["tranquilo", "calmado", "silencioso", "relajado", "peaceful", "quiet"],
  Movido: ["movido", "música en vivo", "vivo", "fiesta", "animado", "ambiente"],
  "Ideal para trabajar": ["wifi", "trabajar", "laptop", "working", "cowork", "enchufe"],
  Romántico: ["romántico", "romantico", "pareja", "cena a la luz", "intimidad"],
  Familiar: ["familiar", "niños", "kids", "chicos", "infantil"],
};

const TIPO_COMIDA_KEYWORDS: Record<string, string[]> = {
  Desayuno: ["desayuno", "breakfast", "tostadas", "medialuna", "café con leche"],
  Brunch: ["brunch", "brunch"],
  Almuerzo: ["almuerzo", "lunch", "menú del día", "menú ejecutivo"],
  Merienda: ["merienda", "té", "tortas", "afternoon"],
  Cena: ["cena", "dinner", "cenar", "noche"],
  Café: ["café", "cafe", "coffee", "bar"],
};

const TIPO_COMIDA_TYPES: Record<string, string[]> = {
  Desayuno: ["breakfast_restaurant", "bakery"],
  Brunch: [],
  Almuerzo: ["meal_delivery", "meal_takeaway", "restaurant", "food"],
  Merienda: ["bakery", "cafe"],
  Cena: ["restaurant", "bar", "meal_delivery", "meal_takeaway"],
  Café: ["cafe", "coffee_shop", "bakery"],
};

const ESPACIO_KEYWORDS: Record<string, string[]> = {
  Salón: ["salón", "salon", "sala", "salón principal", "comedor interior"],
  Terraza: ["terraza", "terrace", "terrazas", "azotea"],
  Vereda: ["vereda", "mesa en la vereda", "mesas en la vereda", "afuera", "frente", "calle"],
  Barra: ["barra", "bar", "counter", "en la barra", "sentado en la barra"],
  Jardín: ["jardín", "jardin", "garden", "al aire libre", "verde", "parque"],
  Patio: ["patio", "patio exterior", "patio interno", "patio cervecero"],
  Comedor: ["comedor", "dining", "mesas", "sector comedor"],
  Interior: ["interior", "indoor", "adentro", "adentro del local", "climatizado"],
};

const ESPACIO_TYPES: Record<string, string[]> = {
  Salón: [],
  Terraza: [],
  Vereda: [],
  Barra: ["bar"],
  Jardín: [],
  Patio: [],
  Comedor: [],
  Interior: [],
};

const COCINA_KEYWORDS: Record<string, string[]> = {
  Japonesa: ["japonés", "japonesa", "japanese", "sushi", "ramen", "sashimi", "nikkei", "tempura"],
  China: ["chino", "china", "chinese", "wok", "dim sum", "cantonesa", "sichuan"],
  India: ["indio", "india", "indian", "curry", "tandoori", "masala"],
  Italiana: ["italiano", "italiana", "italian", "pasta", "pizzeria", "trattoria", "ristorante"],
  Árabe: ["árabe", "arabe", "arab", "libanés", "kebab", "falafel", "hummus", "medio oriente"],
  Peruana: ["peruano", "peruana", "peruvian", "ceviche", "nikkei", "comida peruana"],
  Mexicana: ["mexicano", "mexicana", "mexican", "tacos", "taquería", "taqueria", "burrito", "tex-mex"],
  Argentina: ["parrilla", "asado", "argentino", "argentina", "empanadas", "choripan", "bife"],
  Española: ["español", "española", "spanish", "tapas", "paella", "iberico"],
  Coreana: ["coreano", "coreana", "korean", "korean barbecue", "kimchi", "bibimbap"],
  Thai: ["tailandés", "tailandesa", "thai", "pad thai", "curry tailandés"],
  Vietnamita: ["vietnamita", "vietnamese", "pho", "banh mi"],
  Francesa: ["francés", "francesa", "french", "bistro", "brasserie", "creperie"],
  Vegana: ["vegano", "vegana", "vegan", "plant based", "vegetariano"],
};

function isProductOrDishSpecific(searchQuery: string): boolean {
  const q = searchQuery.trim().toLowerCase();
  const terms = [
    "helado", "sushi", "empanadas", "hamburguesa", "pizza", "café con leche", "medialuna",
    "tacos", "ramen", "asado", "parrilla", "pasta", "milanesa", "bondiola", "choripan",
    "empanada", "ice cream", "burger", "pizza", "sashimi", "ceviche", "wok", "dim sum",
    "falafel", "kebab", "hummus", "curry", "pad thai", "pho", "crepe", "waffle",
    "tostadas", "brunch", "medialunas", "facturas",
  ];
  const words = q.split(/\s+/);
  return words.some((w) => {
    const norm = w.replace(/[áéíóú]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[c] ?? c));
    return terms.some((t) => norm.includes(t) || t.includes(norm));
  });
}

function isCuisineSpecific(searchQuery: string): boolean {
  const q = searchQuery.trim().toLowerCase();
  const terms = [
    "sushi", "japonés", "japonesa", "china", "chino", "comida china", "italiana", "italiano",
    "mexicana", "mexicano", "peruana", "peruano", "árabe", "arabe", "india", "indio",
    "coreano", "coreana", "thai", "tailandés", "vietnamita", "parrilla", "asado",
    "comida japonesa", "comida italiana", "comida mexicana", "comida peruana", "comida india",
  ];
  const words = q.split(/\s+/);
  return words.some((w) => {
    const norm = w.replace(/[áéíóú]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[c] ?? c));
    return terms.some((t) => norm.includes(t) || t.includes(norm));
  });
}

type FilterState = {
  precio: (typeof PRECIO_CHIPS)[number] | null;
  ambiente: string[];
  tipoComida: string[];
  etnia: string[];
  espacio: string[];
  cocina: string[];
  calificacion: (typeof CALIFICACION_CHIPS)[number] | null;
};

function getPlaceSearchText(place: PlaceResult): string {
  const name = (place.name ?? "").toLowerCase();
  const address = (place.formatted_address ?? place.vicinity ?? "").toLowerCase();
  const types = (place.types ?? []).join(" ").toLowerCase();
  const resena = (place.resena_personal ?? "").toLowerCase();
  return `${name} ${address} ${types} ${resena}`;
}

function getPriceBucket(
  priceLevel: number | undefined,
  avgPrice: number
): (typeof PRECIO_CHIPS)[number] | null {
  if (priceLevel == null || Number.isNaN(priceLevel)) return null;
  if (avgPrice <= 0) return priceLevel <= 1 ? "Económico" : priceLevel >= 3 ? "Premium" : "Precio medio";
  if (priceLevel < avgPrice - 0.4) return "Económico";
  if (priceLevel > avgPrice + 0.4) return "Premium";
  return "Precio medio";
}

function placeMatchesAmbiente(place: PlaceResult, chip: (typeof AMBIENTE_CHIPS)[number]): boolean {
  const text = getPlaceSearchText(place);
  const keywords = AMBIENTE_KEYWORDS[chip];
  return keywords.some((k) => text.includes(k));
}

function placeMatchesTipoComida(place: PlaceResult, chip: string): boolean {
  const text = getPlaceSearchText(place);
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const normalizedChip = chip.trim().toLowerCase();
  const directTypeMatch = types.some((t) => t.replace(/_/g, " ").includes(normalizedChip));
  const keywords = TIPO_COMIDA_KEYWORDS[chip as keyof typeof TIPO_COMIDA_KEYWORDS] ?? [];
  const typeList = TIPO_COMIDA_TYPES[chip as keyof typeof TIPO_COMIDA_TYPES] ?? [];
  const matchKw = keywords.some((k) => text.includes(k));
  const matchType = typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt)));
  return directTypeMatch || matchKw || matchType;
}

function placeMatchesEspacio(place: PlaceResult, chip: (typeof ESPACIO_CHIPS)[number]): boolean {
  const text = getPlaceSearchText(place);
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const keywords = ESPACIO_KEYWORDS[chip];
  const typeList = ESPACIO_TYPES[chip];
  const matchKw = keywords.some((k) => text.includes(k));
  const matchType = typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt)));
  return matchKw || matchType;
}

function placeMatchesCocina(place: PlaceResult, cuisineLabel: string): boolean {
  const text = getPlaceSearchText(place);
  const keywords = COCINA_KEYWORDS[cuisineLabel];
  if (!keywords) return false;
  return keywords.some((k) => text.includes(k));
}

function placeMatchesEtnia(place: PlaceResult, chip: (typeof ETNIA_CHIPS)[number]): boolean {
  const text = getPlaceSearchText(place);
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const keywords = ETNIA_KEYWORDS[chip];
  const typeList = ETNIA_TYPES[chip];
  const matchKw = keywords?.some((k) => text.includes(k)) ?? false;
  const matchType = typeList?.length ? typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt))) : false;
  return matchKw || matchType;
}

function placeCardMatchesEtnia(place: PlaceCard, chip: (typeof ETNIA_CHIPS)[number]): boolean {
  const text = [(place.name ?? ""), place.vicinity ?? ""].join(" ").toLowerCase();
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const keywords = ETNIA_KEYWORDS[chip];
  const typeList = ETNIA_TYPES[chip];
  const matchKw = keywords?.some((k) => text.includes(k)) ?? false;
  const matchType = typeList?.length ? typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt))) : false;
  return matchKw || matchType;
}

function getCocinaChipsFromResults(places: PlaceResult[]): string[] {
  return Object.keys(COCINA_KEYWORDS).filter((label) =>
    places.some((p) => placeMatchesCocina(p, label))
  );
}

function computePriceBuckets(places: PlaceResult[]): Map<string, Set<string>> {
  const list = Array.isArray(places) ? places : [];
  const withPrice = list.filter((p) => p.price_level != null && !Number.isNaN(p.price_level));
  const avg =
    withPrice.length > 0
      ? withPrice.reduce((s, p) => s + (p.price_level ?? 0), 0) / withPrice.length
      : 0;
  const map = new Map<string, Set<string>>();
  PRECIO_CHIPS.forEach((c) => map.set(c, new Set()));
  list.forEach((p) => {
    const bucket = getPriceBucket(p.price_level, avg);
    const set = bucket ? map.get(bucket) : null;
    if (set) set.add(p.place_id);
  });
  return map;
}

function applyFilters(
  places: PlaceResult[],
  filters: FilterState
): PlaceResult[] {
  return places.filter((p) => {
    if (filters.calificacion) {
      const minRating = Number.parseFloat(filters.calificacion.replace("+", ""));
      if ((p.rating ?? 0) < minRating) return false;
    }
    if (filters.precio) {
      const withPrice = places.filter((x) => x.price_level != null && !Number.isNaN(x.price_level));
      const avg = withPrice.length ? withPrice.reduce((s, x) => s + (x.price_level ?? 0), 0) / withPrice.length : 0;
      const bucket = getPriceBucket(p.price_level, avg);
      if (bucket !== filters.precio) return false;
    }
    if (filters.ambiente.length > 0) {
      const match = filters.ambiente.some((chip) => placeMatchesAmbiente(p, chip));
      if (!match) return false;
    }
    if (filters.tipoComida.length > 0) {
      const match = filters.tipoComida.some((chip) => placeMatchesTipoComida(p, chip));
      if (!match) return false;
    }
    if (filters.etnia.length > 0) {
      const match = filters.etnia.some((chip) => placeMatchesEtnia(p, chip));
      if (!match) return false;
    }
    if (filters.espacio.length > 0) {
      const match = filters.espacio.some((chip) => placeMatchesEspacio(p, chip));
      if (!match) return false;
    }
    if (filters.cocina.length > 0) {
      const match = filters.cocina.some((label) => placeMatchesCocina(p, label));
      if (!match) return false;
    }
    return true;
  });
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function relevanceScore(place: PlaceResult, searchQuery: string): number {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return 0;
  const name = (place.name ?? "").toLowerCase();
  const address = (place.formatted_address ?? place.vicinity ?? "").toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 2;
  if (address.includes(q)) return 1;
  return 0;
}

function sortSearchResults(
  results: PlaceResult[],
  searchQuery: string,
  userCoords: { lat: number; lng: number } | null
): PlaceResult[] {
  const q = searchQuery.trim().toLowerCase();
  return [...results].sort((a, b) => {
    const relA = relevanceScore(a, q);
    const relB = relevanceScore(b, q);
    if (relB !== relA) return relB - relA;

    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;

    const distA =
      userCoords && a.geometry?.location
        ? distanceM(userCoords.lat, userCoords.lng, a.geometry.location.lat, a.geometry.location.lng)
        : Infinity;
    const distB =
      userCoords && b.geometry?.location
        ? distanceM(userCoords.lat, userCoords.lng, b.geometry.location.lat, b.geometry.location.lng)
        : Infinity;
    return distA - distB;
  });
}

type PlaceCard = {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  type: string;
  types?: string[];
  photo_reference?: string | null;
  photo_url?: string | null;
  distance_m?: number | null;
  geometry?: { location: { lat: number; lng: number } };
  google_maps_url?: string;
  ciudad?: string;
  pais?: string;
  resena_personal?: string;
  fecha_resena?: string;
};

export default function BuscarPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [ciudadSelected, setCiudadSelected] = useState<string>("");
  const [detectedCity, setDetectedCity] = useState<string>("");
  const [paisSelected, setPaisSelected] = useState<string>("");

  const [filterState, setFilterState] = useState<FilterState>({
    precio: null,
    ambiente: [],
    tipoComida: [],
    etnia: [],
    espacio: [],
    cocina: [],
    calificacion: null,
  });

  const filteredResults = useMemo(
    () => applyFilters(results, filterState),
    [results, filterState]
  );

  const filteredPlacesForAbiertos = useMemo(() => {
    return places.filter((p) => {
      if (filterState.calificacion) {
        const minRating = Number.parseFloat(filterState.calificacion.replace("+", ""));
        if ((p.rating ?? 0) < minRating) return false;
      }
      if (filterState.tipoComida.length > 0) {
        const tipo = formatTipoComidaLabel(p.type).toLowerCase();
        const matchTipo = filterState.tipoComida.some((chip) => tipo.includes(chip.toLowerCase()));
        if (!matchTipo) return false;
      }
      return true;
    });
  }, [places, filterState.calificacion, filterState.tipoComida]);

  const availableChips = useMemo(
    () => ({ espacio: [] as string[], showCocina: false, cocina: [] as string[] }),
    []
  );

  const resolvedDetectedCity = useMemo(
    () => resolveCityFromList(detectedCity, ciudades) ?? "",
    [detectedCity, ciudades]
  );

  const fallbackCabaCity = useMemo(
    () => resolveCityFromList("caba", ciudades) ?? "",
    [ciudades]
  );

  const effectiveCity = useMemo(
    () => ciudadSelected.trim() || resolvedDetectedCity || fallbackCabaCity || "",
    [ciudadSelected, resolvedDetectedCity, fallbackCabaCity]
  );

  const tipoComidaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of results) {
      const v = formatTipoComidaLabel(p.types?.[0]);
      if (v && v !== "LUGAR") set.add(v);
    }
    for (const p of places) {
      const v = formatTipoComidaLabel(p.type);
      if (v && v !== "LUGAR") set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [results, places]);

  const toggleFilter = useCallback(
    (group: keyof FilterState, value: string) => {
      setFilterState((prev) => {
        if (group === "calificacion") {
          const next = prev.calificacion === value ? null : (value as FilterState["calificacion"]);
          return { ...prev, calificacion: next };
        }
        if (group === "precio") {
          const next = prev.precio === value ? null : (value as FilterState["precio"]);
          return { ...prev, precio: next };
        }
        const key = group as "ambiente" | "tipoComida" | "etnia" | "espacio" | "cocina";
        const arr = prev[key] as string[];
        const has = arr.includes(value);
        const next = has ? arr.filter((x) => x !== value) : [...arr, value];
        return { ...prev, [key]: next };
      });
    },
    []
  );

  const clearFilter = useCallback((group: keyof FilterState) => {
    setFilterState((prev) => {
      if (group === "calificacion") return { ...prev, calificacion: null };
      if (group === "precio") return { ...prev, precio: null };
      const key = group as "ambiente" | "tipoComida" | "etnia" | "espacio" | "cocina";
      return { ...prev, [key]: [] };
    });
    setOpenDropdown(null);
  }, []);

  const [openDropdown, setOpenDropdown] = useState<
    "precio" | "ambiente" | "tipoComida" | "etnia" | "espacio" | "cocina" | "calificacion" | "ciudad" | null
  >(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (paisSelected.trim()) params.set("pais", paisSelected.trim());
    const url = params.toString() ? `/api/lugares/ciudades?${params.toString()}` : "/api/lugares/ciudades";
    fetch(url)
      .then((res) => (res.ok ? res.json() : { ciudades: [] }))
      .then((data: { ciudades?: string[] }) => {
        setCiudades(Array.isArray(data.ciudades) ? data.ciudades : []);
      })
      .catch(() => setCiudades([]));
  }, [paisSelected]);

  // Detectar ubicación del usuario y guardar coords
  const locationForCityAttempted = useRef(false);
  useEffect(() => {
    if (locationForCityAttempted.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    locationForCityAttempted.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Guardar coords para filtrar recomendaciones por distancia
        setUserCoords({ lat, lng });
        fetch(`/api/geocode/city?lat=${lat}&lng=${lng}`)
          .then((r) => r.json())
          .then((data: { city?: string | null }) => {
            const resolved = (data.city ?? "").trim();
            if (!resolved) return;
            setDetectedCity(resolved);
          })
          .catch(() => {});
      },
      () => { setLocationDenied(true); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    if (!detectedCity.trim() || ciudades.length === 0) return;
    const match = resolveCityFromList(detectedCity, ciudades);
    if (!match) return;
    setCiudadSelected((prev) => {
      const prevNorm = normalizeCityForMatch(prev);
      const detectedNorm = normalizeCityForMatch(detectedCity);
      if (!prevNorm) return match;
      if (prevNorm === detectedNorm) return match;
      return prev;
    });
  }, [detectedCity, ciudades]);

  useEffect(() => {
    if (openDropdown == null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  // Cargar recomendaciones con ciudad (si hay) y radio por coords (si hay)
  const loadRecommendations = useCallback(async (
    pais: string,
    ciudad: string,
    coords: { lat: number; lng: number } | null,
    applyRadius: boolean
  ) => {
    setPlacesLoading(true);
    try {
      const params = new URLSearchParams();
      if (pais.trim()) params.set("pais", pais);
      if (ciudad.trim()) params.set("ciudad", ciudad.trim());
      // Pasar coords solo cuando corresponde aplicar radio (ciudad detectada/default).
      if (coords && applyRadius) {
        params.set("lat", String(coords.lat));
        params.set("lng", String(coords.lng));
        params.set("apply_radius", "1");
      }
      const res = await fetch(`/api/lugares/recommendations?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const list = (data.results ?? []) as PlaceCard[];
      setPlaces(list);
    } catch {
      setPlaces([]);
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    const detectedNorm = normalizeCityForMatch(resolvedDetectedCity || "");
    const effectiveNorm = normalizeCityForMatch(effectiveCity || "");
    const shouldApplyRadius = Boolean(userCoords) && Boolean(detectedNorm) && detectedNorm === effectiveNorm;
    loadRecommendations(paisSelected, effectiveCity, userCoords, shouldApplyRadius);
  }, [loadRecommendations, paisSelected, effectiveCity, userCoords, resolvedDetectedCity]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("restauranteReturnPath", "/buscar");
    }
  }, []);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q });
      if (paisSelected.trim()) params.set("pais", paisSelected.trim());
      if (ciudadSelected.trim()) params.set("ciudad", ciudadSelected.trim());
      const res = await fetch(`/api/lugares/search?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      let data: { results?: PlaceResult[]; error?: string };
      try {
        data = JSON.parse(text);
      } catch {
        const msg = text.startsWith("<!")
          ? "El servidor respondió con HTML. Revisá que la app esté corriendo (npm run dev) y que la ruta /api/lugares/search exista."
          : "Respuesta inválida del servidor.";
        throw new Error(msg);
      }
      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status} en la búsqueda`);
      }
      const raw = (data.results ?? []) as PlaceResult[];
      setResults(sortSearchResults(raw, q, userCoords));
      setHasActiveSearch(true);
      setFilterState({ precio: null, ambiente: [], tipoComida: [], etnia: [], espacio: [], cocina: [], calificacion: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en la búsqueda");
      setResults([]);
      setHasActiveSearch(false);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasActiveSearch(false);
    setError(null);
    setFilterState({ precio: null, ambiente: [], tipoComida: [], etnia: [], espacio: [], cocina: [], calificacion: null });
  }, []);

  return (
    <div className="min-h-screen bg-[#fffbf8] pb-32">
      {loading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#fffbf8]/90 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#152f33]/20 border-t-[#E45AFF]" />
          <p className="font-manrope text-base font-medium tracking-[-0.64px] text-[#152f33]">
            Buscando…
          </p>
        </div>
      )}
      <div className="mx-auto max-w-[1000px] px-4 pt-4">
        {error && (
          <div className="font-manrope mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/95 p-4 text-[var(--text-primary)]" role="alert">
            <p className="font-medium text-amber-900">Error en la búsqueda</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]/80">
              {/facturación|billing|console\.cloud\.google/i.test(error) ? (
                <>
                  Para usar la búsqueda, activá la facturación en tu proyecto de Google Cloud (incluye crédito gratis mensual).{" "}
                  <a
                    href="https://console.cloud.google.com/project/_/billing/enable"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Activar facturación →
                  </a>
                </>
              ) : (
                error
              )}
            </p>
          </div>
        )}

        {/* Resultados de búsqueda: se muestran cuando hay resultados, tapan las recomendaciones */}
        {results.length > 0 && (
          <div ref={dropdownRef} className="mt-6 w-full md:mt-10">
            <div className="flex flex-col gap-5">
              <p className="font-heading text-[28px] font-medium leading-normal tracking-[-1.12px] text-[#152f33] md:text-[40px] md:tracking-[-1.6px]">
                Resultados de búsqueda
                {filteredResults.length !== results.length && (
                  <span className="font-manrope ml-2 text-base font-normal text-[#152f33]/70 md:text-lg">
                    ({filteredResults.length} de {results.length})
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.tipoComida.length > 0
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "tipoComida" ? null : "tipoComida"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.tipoComida.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.tipoComida.length > 0 ? filterState.tipoComida.join(", ") : "Tipo de comida"}
                    </button>
                    {filterState.tipoComida.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearFilter("tipoComida")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Tipo de comida"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "tipoComida" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {tipoComidaOptions.map((chip) => {
                        const active = filterState.tipoComida.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleFilter("tipoComida", chip)}
                            className={`font-manrope flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                          >
                            {active && <span className="text-[var(--btn-primary-from)]">✓</span>}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.calificacion
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "calificacion" ? null : "calificacion"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.calificacion ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.calificacion ?? "Calificación"}
                    </button>
                    {filterState.calificacion && (
                      <button
                        type="button"
                        onClick={() => clearFilter("calificacion")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Calificación"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "calificacion" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {CALIFICACION_CHIPS.map((chip) => {
                        const active = filterState.calificacion === chip;
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleFilter("calificacion", chip)}
                            className={`font-manrope flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                          >
                            {active && <span className="text-[var(--btn-primary-from)]">✓</span>}
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 md:gap-4 md:pb-2">
                {filteredResults.map((place) => (
                  <BuscarCard
                    key={place.place_id}
                    placeId={place.place_id}
                    name={place.name}
                    category={formatTipoComidaLabel(place.types?.[0])}
                    ciudad={place.ciudad}
                    pais={place.pais}
                    rating={place.rating}
                    reviewText={place.resena_personal}
                    reviewDate={place.fecha_resena}
                    photoUrl={place.photoUrl}
                    photoReference={place.photos?.[0]?.photo_reference}
                    lat={place.geometry?.location?.lat}
                    lng={place.geometry?.location?.lng}
                    distance_m={null}
                    google_maps_url={place.google_maps_url ?? "#"}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && results.length === 0 && query.trim() && !error && (
          <p className="font-manrope mt-8 text-[#152f33]/70">No se encontraron resultados.</p>
        )}
        {results.length > 0 && filteredResults.length === 0 && (
          <p className="font-manrope mt-4 text-[#152f33]/70">
            Ningún resultado coincide con los filtros. Probá quitando alguno.
          </p>
        )}

        {/* Recomendaciones por zona: solo se muestran cuando NO hay búsqueda activa */}
        {!hasActiveSearch && results.length === 0 && (
          <div className="mt-6 w-full md:mt-10">
            {placesLoading ? (
              <p className="font-manrope text-[#152f33]/80">Cargando recomendaciones…</p>
            ) : (
              <div ref={dropdownRef} className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-heading text-[28px] font-medium leading-normal tracking-[-1.12px] text-[#152f33] md:text-[40px] md:tracking-[-1.6px]">
                    Recomendaciones en
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "ciudad" ? null : "ciudad"))}
                      className="inline-flex items-center gap-3"
                      aria-label="Seleccionar ciudad"
                    >
                      <span className="font-heading text-[28px] font-medium italic leading-normal tracking-[-1.12px] text-[#E45AFF] md:text-[40px] md:tracking-[-1.6px]">
                        {effectiveCity || "Seleccioná ciudad"}
                      </span>
                      <svg
                        className="h-6 w-6 text-[#152f33] transition-transform duration-200"
                        style={{ transform: openDropdown === "ciudad" ? "rotate(90deg)" : "rotate(0deg)" }}
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {openDropdown === "ciudad" && (
                      <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                        {resolvedDetectedCity && (
                          <button
                            type="button"
                            onClick={() => {
                              setCiudadSelected(resolvedDetectedCity);
                              setOpenDropdown(null);
                            }}
                            className={`font-manrope flex w-full items-center px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${
                              ciudadSelected.trim().toLowerCase() === resolvedDetectedCity.toLowerCase()
                                ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium"
                                : "text-[#152f33]"
                            }`}
                          >
                            {resolvedDetectedCity}
                          </button>
                        )}
                        {ciudades.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setCiudadSelected(c);
                              setOpenDropdown(null);
                            }}
                            className={`font-manrope flex w-full items-center px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${
                              ciudadSelected === c ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {filteredPlacesForAbiertos.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-3">
                      <div className="relative shrink-0">
                        <div
                          role="group"
                          className={`flex items-center rounded-[1000px] overflow-hidden ${
                            filterState.tipoComida.length > 0
                              ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                              : "border border-[#f7f3f1] bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenDropdown((d) => (d === "tipoComida" ? null : "tipoComida"))}
                            className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                              filterState.tipoComida.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                            }`}
                          >
                            {filterState.tipoComida.length > 0 ? filterState.tipoComida.join(", ") : "Tipo de comida"}
                          </button>
                          {filterState.tipoComida.length > 0 && (
                            <button
                              type="button"
                              onClick={() => clearFilter("tipoComida")}
                              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                              aria-label="Quitar filtro Tipo de comida"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {openDropdown === "tipoComida" && (
                          <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                            {tipoComidaOptions.map((chip) => {
                              const active = filterState.tipoComida.includes(chip);
                              return (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => toggleFilter("tipoComida", chip)}
                                  className={`font-manrope flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                                >
                                  {active && <span className="text-[var(--btn-primary-from)]">✓</span>}
                                  {chip}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="relative shrink-0">
                        <div
                          role="group"
                          className={`flex items-center rounded-[1000px] overflow-hidden ${
                            filterState.calificacion
                              ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                              : "border border-[#f7f3f1] bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenDropdown((d) => (d === "calificacion" ? null : "calificacion"))}
                            className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                              filterState.calificacion ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                            }`}
                          >
                            {filterState.calificacion ?? "Calificación"}
                          </button>
                          {filterState.calificacion && (
                            <button
                              type="button"
                              onClick={() => clearFilter("calificacion")}
                              className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                              aria-label="Quitar filtro Calificación"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {openDropdown === "calificacion" && (
                          <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                            {CALIFICACION_CHIPS.map((chip) => {
                              const active = filterState.calificacion === chip;
                              return (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => toggleFilter("calificacion", chip)}
                                  className={`font-manrope flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                                >
                                  {active && <span className="text-[var(--btn-primary-from)]">✓</span>}
                                  {chip}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 md:gap-4 md:pb-2">
                      {filteredPlacesForAbiertos.map((place) => (
                        <BuscarCard
                          key={place.place_id}
                          placeId={place.place_id}
                          name={place.name}
                          category={formatTipoComidaLabel(place.type)}
                          ciudad={place.ciudad}
                          pais={place.pais}
                          rating={place.rating}
                          reviewText={place.resena_personal}
                          reviewDate={place.fecha_resena}
                          photoUrl={place.photo_url ?? undefined}
                          photoReference={place.photo_reference}
                          lat={place.geometry?.location?.lat}
                          lng={place.geometry?.location?.lng}
                          distance_m={place.distance_m}
                          google_maps_url={place.google_maps_url ?? "#"}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="font-manrope text-[#152f33]/80">
                    No hay recomendaciones en {effectiveCity || "esta ciudad"} en este momento.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gradiente inferior */}
        <div
          className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 h-[171px]"
          style={{
            background: "linear-gradient(to bottom, rgba(255,251,248,0) 0%, #fffbf8 92.14%)",
          }}
        />

        {/* Barra de búsqueda fija */}
        <div className="fixed bottom-[24px] left-1/2 z-40 w-[calc(100%-2rem)] max-w-[1000px] -translate-x-1/2 md:bottom-0 md:w-full md:max-w-none md:bg-[#fffbf8]/90 md:py-4 md:backdrop-blur-sm">
          <div
            className="flex w-full items-center justify-between gap-3 px-5 py-2.5 md:mx-auto md:max-w-[1000px] md:px-4"
            style={{
              borderRadius: "100px",
              border: "1px solid rgba(228, 90, 255, 0.2)",
              background: "linear-gradient(180deg, #FAFAFA 0%, #FFF 100%)",
              boxShadow: "2px 2px 12px 0 rgba(228, 90, 255, 0.10)",
            }}
          >
            <div className="relative flex min-h-9 flex-1 items-center overflow-hidden">
              <input
                id="buscar-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className={`relative z-10 min-w-0 flex-1 font-manrope text-base font-medium tracking-[-0.64px] text-[#152f33] placeholder:text-[#152f33]/50 focus:outline-none md:tracking-[-0.72px] ${
                  query.trim() ? "bg-white/90" : "bg-transparent"
                }`}
                placeholder={`Buscar  ${ROTATING_PLACEHOLDERS[placeholderIndex]}…`}
              />
            </div>
            <span className="cta-stroke-gradient-animate inline-flex shrink-0 rounded-full p-[1px]">
              {hasActiveSearch ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="group relative inline-flex overflow-hidden rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.7)] to-[rgba(216,48,249,0.7)] font-manrope font-medium leading-normal text-white tracking-[-0.72px] transition-all duration-300 hover:opacity-90 md:h-12 md:w-12 md:min-w-0"
                  aria-label="Limpiar búsqueda y volver al inicio"
                >
                  <span className="relative z-10 flex h-10 w-10 items-center justify-center md:h-12 md:w-12">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 md:h-6 md:w-6">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={search}
                  disabled={loading}
                  className="group relative inline-flex items-center justify-center gap-[10px] overflow-hidden rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.7)] to-[rgba(216,48,249,0.7)] px-6 py-3 font-manrope font-medium leading-normal text-white tracking-[-0.72px] transition-all duration-300 disabled:opacity-60"
                  aria-label="Buscar"
                >
                  <span
                    className="absolute inset-x-0 bottom-0 h-full origin-bottom scale-y-0 bg-gradient-to-t from-[rgba(255,255,255,0.18)] via-[rgba(255,200,255,0.08)] to-transparent transition-transform duration-500 ease-in-out group-hover:scale-y-100"
                    aria-hidden
                  />
                  <span className="relative z-10 flex items-center justify-center gap-[10px]">
                    <Image
                      src="/search-ai-icon@2x.png"
                      alt=""
                      width={40}
                      height={40}
                      className="h-4 w-4 object-contain mix-blend-lighten md:h-5 md:w-5"
                      unoptimized
                    />
                    <span className="font-manrope text-base font-medium leading-normal tracking-[-0.72px] md:text-lg">Buscar</span>
                  </span>
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
