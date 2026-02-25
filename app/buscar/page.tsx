"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/components/Providers";
import { useToast } from "@/components/ToastContext";
import type { ChipItem } from "@/components/BuscarCard";
import { BuscarCard, getCategory } from "@/components/BuscarCard";
import type { PlaceResult } from "@/types/places";

const ROTATING_PLACEHOLDERS = [
  "cafes con buen wifi",
  "brunch en palermo",
  "almorzar pet friendly",
  "hamburguesa viral",
  "cena veggie en nuñez",
];

// --- Filtros: definición y lógica ---

const PRECIO_CHIPS = ["Económico", "Precio medio", "Premium"] as const;
const AMBIENTE_CHIPS = ["Tranquilo", "Movido", "Ideal para trabajar", "Romántico", "Familiar"] as const;
const TIPO_COMIDA_CHIPS = ["Desayuno", "Brunch", "Almuerzo", "Merienda", "Cena", "Café"] as const;
const ESPACIO_CHIPS = ["Salón", "Terraza", "Vereda", "Barra", "Jardín", "Patio", "Comedor", "Interior"] as const;

/** Etnia/cocina: filtro fijo (comida según etnia). */
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

// Cocina/etnia: chips dinámicos según resultados. Keywords para detectar cada cocina en nombre/tipos.
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

/** Búsqueda sobre un producto/plato específico (helado, pizza, sushi): no mostrar AMBIENTE ni TIPO DE COMIDA. */
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

/** Búsqueda que ya especifica cocina/etnia (sushi, comida china): no mostrar filtro ETNIA/COCINA. */
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
  ambiente: (typeof AMBIENTE_CHIPS)[number][];
  tipoComida: (typeof TIPO_COMIDA_CHIPS)[number][];
  etnia: (typeof ETNIA_CHIPS)[number][];
  espacio: (typeof ESPACIO_CHIPS)[number][];
  cocina: string[];
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

function placeMatchesTipoComida(place: PlaceResult, chip: (typeof TIPO_COMIDA_CHIPS)[number]): boolean {
  const text = getPlaceSearchText(place);
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const keywords = TIPO_COMIDA_KEYWORDS[chip];
  const typeList = TIPO_COMIDA_TYPES[chip];
  const matchKw = keywords.some((k) => text.includes(k));
  const matchType = typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt)));
  return matchKw || matchType;
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

/** Igual que placeMatchesEtnia pero para PlaceCard (Abiertos ahora / recomendaciones por zona). */
function placeCardMatchesEtnia(place: PlaceCard, chip: (typeof ETNIA_CHIPS)[number]): boolean {
  const text = [(place.name ?? ""), place.vicinity ?? ""].join(" ").toLowerCase();
  const types = (place.types ?? []).map((t) => t.toLowerCase());
  const keywords = ETNIA_KEYWORDS[chip];
  const typeList = ETNIA_TYPES[chip];
  const matchKw = keywords?.some((k) => text.includes(k)) ?? false;
  const matchType = typeList?.length ? typeList.some((t) => types.some((pt) => pt.includes(t) || t.includes(pt))) : false;
  return matchKw || matchType;
}

/** Cocinas que aparecen en los resultados (solo labels que tienen al menos un lugar). */
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

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // radio Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Puntuación de similitud con la búsqueda: mayor = más relevante. */
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

/** Ordena resultados por: similitud a la búsqueda, puntuación, cercanía. */
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
        ? distanceM(
            userCoords.lat,
            userCoords.lng,
            a.geometry.location.lat,
            a.geometry.location.lng
          )
        : Infinity;
    const distB =
      userCoords && b.geometry?.location
        ? distanceM(
            userCoords.lat,
            userCoords.lng,
            b.geometry.location.lat,
            b.geometry.location.lng
          )
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
  /** URL de la foto generada en servidor (prioritaria para que cargue bien). */
  photo_url?: string | null;
  distance_m?: number | null;
  geometry?: { location: { lat: number; lng: number } };
  google_maps_url?: string;
  ciudad?: string;
  pais?: string;
};

export default function BuscarPage() {
  const { user, signInWithGoogle } = useAuth();
  const { showToast } = useToast();
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
  const [paisSelected, setPaisSelected] = useState<string>("AR");
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favLoadingId, setFavLoadingId] = useState<string | null>(null);
  const [chipsByPlaceId, setChipsByPlaceId] = useState<Record<string, ChipItem[]>>({});

  const [filterState, setFilterState] = useState<FilterState>({
    precio: null,
    ambiente: [],
    tipoComida: [],
    etnia: [],
    espacio: [],
    cocina: [],
  });

  const filteredResults = useMemo(
    () => applyFilters(results, filterState),
    [results, filterState]
  );

  /** En "Recomendaciones por tu zona" aplicamos solo filtro Etnia (tenemos types en PlaceCard). */
  const filteredPlacesForAbiertos = useMemo(() => {
    if (filterState.etnia.length === 0) return places;
    return places.filter((p) => filterState.etnia.some((chip) => placeCardMatchesEtnia(p, chip)));
  }, [places, filterState.etnia]);

  const searchQuery = query.trim().toLowerCase();
  const availableChips = useMemo(() => {
    const list = Array.isArray(results) ? results : [];
    const priceBuckets = computePriceBuckets(list);
    const precio = PRECIO_CHIPS.filter((c) => (priceBuckets?.get(c)?.size ?? 0) > 0);
    const ambiente = AMBIENTE_CHIPS.filter((c) =>
      list.some((p) => placeMatchesAmbiente(p, c))
    );
    const tipoComida = TIPO_COMIDA_CHIPS.filter((c) =>
      list.some((p) => placeMatchesTipoComida(p, c))
    );
    const espacio = ESPACIO_CHIPS.filter((c) =>
      list.some((p) => placeMatchesEspacio(p, c))
    );
    const cocinaLabels = getCocinaChipsFromResults(list);
    const showAmbiente = !isProductOrDishSpecific(searchQuery) && ambiente.length > 0;
    const showTipoComida = !isProductOrDishSpecific(searchQuery) && tipoComida.length > 0;
    const showCocina =
      !isCuisineSpecific(searchQuery) &&
      cocinaLabels.length >= 2 &&
      list.length > 0;
    return {
      precio,
      ambiente,
      tipoComida,
      espacio,
      cocina: cocinaLabels,
      showAmbiente,
      showTipoComida,
      showCocina,
    };
  }, [results, searchQuery]);

  const toggleFilter = useCallback(
    (group: keyof FilterState, value: string) => {
      setFilterState((prev) => {
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
      if (group === "precio") return { ...prev, precio: null };
      const key = group as "ambiente" | "tipoComida" | "etnia" | "espacio" | "cocina";
      return { ...prev, [key]: [] };
    });
    setOpenDropdown(null);
  }, []);

  const [openDropdown, setOpenDropdown] = useState<
    "precio" | "ambiente" | "tipoComida" | "etnia" | "espacio" | "cocina" | null
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
    fetch("/api/lugares/ciudades")
      .then((res) => (res.ok ? res.json() : { ciudades: [] }))
      .then((data: { ciudades?: string[] }) => {
        setCiudades(Array.isArray(data.ciudades) ? data.ciudades : []);
      })
      .catch(() => setCiudades([]));
  }, []);

  const locationForCityAttempted = useRef(false);
  useEffect(() => {
    if (locationForCityAttempted.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    locationForCityAttempted.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetch(`/api/geocode/city?lat=${lat}&lng=${lng}`)
          .then((r) => r.json())
          .then((data: { city?: string | null }) => {
            const resolved = (data.city ?? "").trim();
            if (!resolved) return;
            setCiudades((list) => {
              if (list.length === 0) return list;
              const exact = list.find((c) => c.trim() === resolved);
              if (exact !== undefined) {
                setCiudadSelected((prev) => (prev === "" ? exact : prev));
                return list;
              }
              const normResolved = resolved.toLowerCase();
              const match = list.find(
                (c) => {
                  const cTrim = c.trim();
                  const cNorm = cTrim.toLowerCase();
                  return cTrim === resolved || cNorm === normResolved || cNorm.includes(normResolved) || normResolved.includes(cNorm);
                }
              );
              if (match !== undefined) {
                setCiudadSelected((prev) => (prev === "" ? match : prev));
              }
              return list;
            });
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Chips vienen en la respuesta de /api/lugares (search y recommendations); se actualizan al setear results/places

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

  useEffect(() => {
    if (!user) {
      setFavoritedIds(new Set());
      return;
    }
    fetch("/api/favoritos", { credentials: "include" })
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return { favoritos: [] };
        }
      })
      .then((data) => {
        const list = (data.favoritos ?? []) as Array<{ place_id: string }>;
        setFavoritedIds(new Set(list.map((f) => f.place_id)));
      })
      .catch(() => setFavoritedIds(new Set()));
  }, [user]);

  const toggleFav = useCallback(
    async (
      placeId: string,
      payload: { name?: string; formatted_address?: string; rating?: number; photo_reference?: string | null }
    ) => {
      if (!user) {
        signInWithGoogle();
        return;
      }
      setFavLoadingId(placeId);
      const isFav = favoritedIds.has(placeId);
      try {
        if (isFav) {
          const res = await fetch(`/api/favoritos?place_id=${encodeURIComponent(placeId)}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (res.ok) {
            setFavoritedIds((prev) => {
              const next = new Set(prev);
              next.delete(placeId);
              return next;
            });
          }
        } else {
          const res = await fetch("/api/favoritos", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              place_id: placeId,
              name: payload.name ?? undefined,
              formatted_address: payload.formatted_address ?? undefined,
              rating: payload.rating ?? undefined,
              photo_reference: payload.photo_reference ?? undefined,
            }),
          });
          if (res.ok) {
            setFavoritedIds((prev) => new Set(Array.from(prev).concat(placeId)));
            showToast(`${payload.name ?? "Lugar"} agregado a favoritos`);
          } else {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error;
            showToast(
              msg === "No autenticado"
                ? "Iniciá sesión para guardar favoritos"
                : msg && typeof msg === "string"
                  ? msg
                  : "No se pudo guardar"
            );
          }
        }
      } finally {
        setFavLoadingId(null);
      }
    },
    [user, signInWithGoogle, favoritedIds, showToast]
  );

  const loadRecommendations = useCallback(async (pais: string, ciudad: string) => {
    setPlacesLoading(true);
    try {
      const params = new URLSearchParams({ pais });
      if (ciudad.trim()) params.set("ciudad", ciudad.trim());
      const res = await fetch(`/api/lugares/recommendations?${params.toString()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const list = (data.results ?? []) as (PlaceCard & { chips?: ChipItem[] })[];
      setPlaces(list);
      setChipsByPlaceId((prev) => ({
        ...prev,
        ...Object.fromEntries(
          list.filter((p) => (p.chips?.length ?? 0) > 0).map((p) => [p.place_id, p.chips!])
        ),
      }));
    } catch {
      setPlaces([]);
    } finally {
      setPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations(paisSelected, ciudadSelected);
  }, [loadRecommendations, paisSelected, ciudadSelected]);

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
      const params = new URLSearchParams({ q, pais: paisSelected });
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
      setChipsByPlaceId((prev) => ({
        ...prev,
        ...Object.fromEntries(
          raw.filter((p) => (p.chips?.length ?? 0) > 0).map((p) => [p.place_id, p.chips!])
        ),
      }));
      setHasActiveSearch(true);
      setFilterState({ precio: null, ambiente: [], tipoComida: [], etnia: [], espacio: [], cocina: [] });
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
    setFilterState({ precio: null, ambiente: [], tipoComida: [], etnia: [], espacio: [], cocina: [] });
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

      {/* Recomendaciones por tu zona: selector ciudad + título + filtros chips + cards */}
      {results.length === 0 && (
        <div className="mt-6 w-full md:mt-10">
          {placesLoading ? (
            <p className="font-manrope text-[#152f33]/80">Cargando recomendaciones…</p>
          ) : (
            <div ref={dropdownRef} className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-manrope text-sm font-medium text-[#152f33]/80">Ciudad:</span>
                  <select
                    value={ciudadSelected}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCiudadSelected(next);
                      loadRecommendations(paisSelected, next);
                    }}
                    className="font-manrope rounded-[1000px] border border-[#152f33]/20 bg-white px-4 py-2 text-base text-[#152f33] focus:outline-none focus:ring-2 focus:ring-[#E45AFF]/40"
                    aria-label="Seleccionar ciudad"
                  >
                    <option value="">Todas</option>
                    {ciudades.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <p className="font-heading text-[28px] font-medium leading-normal tracking-[-1.12px] text-[#152f33] md:text-[40px] md:tracking-[-1.6px]">
                  Recomendaciones por tu zona
                </p>
                {filteredPlacesForAbiertos.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-3">
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.ambiente.length > 0
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "ambiente" ? null : "ambiente"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.ambiente.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.ambiente.length > 0 ? (
                        filterState.ambiente.join(", ")
                      ) : (
                        <>
                          Ambiente
                          <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {filterState.ambiente.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearFilter("ambiente")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Ambiente"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "ambiente" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {AMBIENTE_CHIPS.map((chip) => {
                        const active = filterState.ambiente.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleFilter("ambiente", chip)}
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
                      {filterState.tipoComida.length > 0 ? (
                        filterState.tipoComida.join(", ")
                      ) : (
                        <>
                          Comida
                          <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {filterState.tipoComida.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearFilter("tipoComida")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Comida"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "tipoComida" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {TIPO_COMIDA_CHIPS.map((chip) => {
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
                      filterState.precio
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "precio" ? null : "precio"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.precio ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.precio ? (
                        filterState.precio
                      ) : (
                        <>
                          Precio
                          <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {filterState.precio && (
                      <button
                        type="button"
                        onClick={() => clearFilter("precio")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Precio"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "precio" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {PRECIO_CHIPS.map((chip) => {
                        const active = filterState.precio === chip;
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleFilter("precio", chip)}
                            className={`font-manrope w-full px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Etnia: comida según etnia */}
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.etnia.length > 0
? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                    : "border border-[#f7f3f1] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((d) => (d === "etnia" ? null : "etnia"))}
                    className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                      filterState.etnia.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                    }`}
                  >
                    {filterState.etnia.length > 0 ? (
                      filterState.etnia.join(", ")
                    ) : (
                      <>
                        Etnia
                        <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {filterState.etnia.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearFilter("etnia")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                      aria-label="Quitar filtro Etnia"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {openDropdown === "etnia" && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] min-w-[180px] overflow-y-auto rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                    {ETNIA_CHIPS.map((chip) => {
                      const active = filterState.etnia.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleFilter("etnia", chip)}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-4 md:pb-2">
                {filteredPlacesForAbiertos.map((place) => {
                  return (
                    <BuscarCard
                      key={place.place_id}
                      placeId={place.place_id}
                      name={place.name}
                      category={place.type?.toUpperCase().replace(/_/g, " ") ?? "LUGAR"}
                      ciudad={place.ciudad}
                      pais={place.pais}
                      rating={place.rating}
                      photoUrl={place.photo_url ?? undefined}
                      photoReference={place.photo_reference}
                      lat={place.geometry?.location?.lat}
                      lng={place.geometry?.location?.lng}
                      google_maps_url={place.google_maps_url ?? "#"}
                      isFav={favoritedIds.has(place.place_id)}
                      onToggleFav={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFav(place.place_id, {
                          name: place.name,
                          formatted_address: place.vicinity,
                          rating: place.rating,
                          photo_reference: place.photo_reference ?? undefined,
                        });
                      }}
                      favLoading={favLoadingId === place.place_id}
                      chips={chipsByPlaceId[place.place_id] ?? []}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <p className="font-manrope text-[#152f33]/80">
              No hay recomendaciones para tu zona en este momento.
            </p>
          )}
            </div>
          )}
        </div>
      )}

      {/* Resultados de búsqueda (Figma 38:469): título + filtros chips + cards */}
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
            {/* Filtros como chips (Figma 45:447): Ambiente, Comida, Precio */}
            <div className="flex flex-wrap gap-3">
              <div className="relative shrink-0">
                <div
                  role="group"
                  className={`flex items-center rounded-[1000px] overflow-hidden ${
                    filterState.ambiente.length > 0
? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                    : "border border-[#f7f3f1] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((d) => (d === "ambiente" ? null : "ambiente"))}
                    className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                      filterState.ambiente.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                    }`}
                  >
                    {filterState.ambiente.length > 0 ? (
                      filterState.ambiente.join(", ")
                    ) : (
                      <>
                        Ambiente
                        <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {filterState.ambiente.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearFilter("ambiente")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                      aria-label="Quitar filtro Ambiente"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {openDropdown === "ambiente" && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                    {AMBIENTE_CHIPS.map((chip) => {
                      const active = filterState.ambiente.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleFilter("ambiente", chip)}
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
                    {filterState.tipoComida.length > 0 ? (
                      filterState.tipoComida.join(", ")
                    ) : (
                      <>
                        Comida
                        <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {filterState.tipoComida.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearFilter("tipoComida")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                      aria-label="Quitar filtro Comida"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {openDropdown === "tipoComida" && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                    {TIPO_COMIDA_CHIPS.map((chip) => {
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
                    filterState.precio
? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                    : "border border-[#f7f3f1] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((d) => (d === "precio" ? null : "precio"))}
                    className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                      filterState.precio ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                    }`}
                  >
                    {filterState.precio ? (
                      filterState.precio
                    ) : (
                      <>
                        Precio
                        <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {filterState.precio && (
                    <button
                      type="button"
                      onClick={() => clearFilter("precio")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                      aria-label="Quitar filtro Precio"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {openDropdown === "precio" && (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                    {PRECIO_CHIPS.map((chip) => {
                      const active = filterState.precio === chip;
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleFilter("precio", chip)}
                          className={`font-manrope w-full px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Etnia: comida según etnia */}
              <div className="relative shrink-0">
                <div
                  role="group"
                  className={`flex items-center rounded-[1000px] overflow-hidden ${
                    filterState.etnia.length > 0
? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                    : "border border-[#f7f3f1] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDropdown((d) => (d === "etnia" ? null : "etnia"))}
                    className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                      filterState.etnia.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                    }`}
                  >
                    {filterState.etnia.length > 0 ? (
                      filterState.etnia.join(", ")
                    ) : (
                      <>
                        Etnia
                        <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {filterState.etnia.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearFilter("etnia")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                      aria-label="Quitar filtro Etnia"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {openDropdown === "etnia" && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] min-w-[180px] overflow-y-auto rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                    {ETNIA_CHIPS.map((chip) => {
                      const active = filterState.etnia.includes(chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleFilter("etnia", chip)}
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
              {availableChips.espacio.length > 0 && (
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.espacio.length > 0
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "espacio" ? null : "espacio"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.espacio.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.espacio.length > 0 ? (
                        filterState.espacio.join(", ")
                      ) : (
                        <>
                          Espacio
                          <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {filterState.espacio.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearFilter("espacio")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Espacio"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "espacio" && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {availableChips.espacio.map((chip) => {
                        const active = filterState.espacio.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleFilter("espacio", chip)}
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
              )}
              {availableChips.showCocina && (
                <div className="relative shrink-0">
                  <div
                    role="group"
                    className={`flex items-center rounded-[1000px] overflow-hidden ${
                      filterState.cocina.length > 0
                        ? "border border-[#191E1F] text-[#191E1F] bg-[linear-gradient(180deg,rgba(108,130,133,0.12)_0%,rgba(25,30,31,0.12)_100%)]"
                        : "border border-[#f7f3f1] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenDropdown((d) => (d === "cocina" ? null : "cocina"))}
                      className={`flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-left font-manrope text-base font-medium leading-normal tracking-[-0.64px] ${
                        filterState.cocina.length > 0 ? "text-[#191E1F] hover:bg-black/5" : "text-[#152f33] hover:bg-[#fafafa]"
                      }`}
                    >
                      {filterState.cocina.length > 0 ? (
                        filterState.cocina.join(", ")
                      ) : (
                        <>
                          Cocina
                          <svg className="h-6 w-6 shrink-0 text-[#152f33]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                    {filterState.cocina.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearFilter("cocina")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-[#191E1F] hover:bg-black/10"
                        aria-label="Quitar filtro Cocina"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {openDropdown === "cocina" && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] min-w-[180px] overflow-y-auto rounded-xl border border-[#152f33]/15 bg-white py-2 shadow-lg">
                      {availableChips.cocina.map((label) => {
                        const active = filterState.cocina.includes(label);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => toggleFilter("cocina", label)}
                            className={`font-manrope flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-[#152f33]/5 ${active ? "bg-[var(--btn-primary-from)]/15 text-[var(--btn-primary-from)] font-medium" : "text-[#152f33]"}`}
                          >
                            {active && <span className="text-[var(--btn-primary-from)]">✓</span>}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-4 md:pb-2">
            {filteredResults.map((place) => {
              return (
                <BuscarCard
                  key={place.place_id}
                  placeId={place.place_id}
                  name={place.name}
                  category={getCategory(place.types)}
                  ciudad={place.ciudad}
                  pais={place.pais}
                  rating={place.rating}
                  photoUrl={place.photoUrl}
                  photoReference={place.photos?.[0]?.photo_reference}
                  lat={place.geometry?.location?.lat}
                  lng={place.geometry?.location?.lng}
                  google_maps_url={place.google_maps_url ?? "#"}
                  isFav={favoritedIds.has(place.place_id)}
                  onToggleFav={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFav(place.place_id, {
                      name: place.name,
                      formatted_address: place.formatted_address ?? undefined,
                      rating: place.rating ?? undefined,
                      photo_reference: place.photos?.[0]?.photo_reference,
                    });
                  }}
                  favLoading={favLoadingId === place.place_id}
                  chips={chipsByPlaceId[place.place_id] ?? []}
                />
              );
            })}
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

      {/* Gradiente inferior (Figma 38:941) */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 h-[171px]"
        style={{
          background: "linear-gradient(to bottom, rgba(255,251,248,0) 0%, #fffbf8 92.14%)",
        }}
      />

      {/* Barra de búsqueda fija */}
      <div className="fixed bottom-[24px] left-1/2 right-4 z-40 w-full max-w-[354px] -translate-x-1/2 px-4 md:bottom-0 md:left-0 md:right-0 md:max-w-none md:translate-x-0 md:bg-[#fffbf8]/90 md:py-4 md:backdrop-blur-sm">
        <div
          className="flex w-full items-center justify-between gap-3 px-5 py-2.5 md:max-w-[1000px] md:mx-auto md:px-4"
          style={{
            borderRadius: "100px",
            border: "1px solid #E45AFF",
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
                className="group relative inline-flex overflow-hidden rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.7)] to-[rgba(216,48,249,0.7)] font-manrope font-medium leading-normal text-white tracking-[-0.72px] transition-all duration-300 disabled:opacity-60 md:gap-2 md:px-6 md:py-3"
                aria-label="Buscar"
              >
                <span
                  className="absolute inset-x-0 bottom-0 h-full origin-bottom scale-y-0 bg-gradient-to-t from-[rgba(255,255,255,0.18)] via-[rgba(255,200,255,0.08)] to-transparent transition-transform duration-500 ease-in-out group-hover:scale-y-100"
                  aria-hidden
                />
                <span className="relative z-10 flex h-10 w-10 items-center justify-center gap-1 md:h-auto md:w-auto md:min-w-0">
                  <Image
                    src="/search-ai-icon@2x.png"
                    alt=""
                    width={40}
                    height={40}
                    className="h-4 w-4 md:h-5 md:w-5 object-contain mix-blend-lighten"
                    unoptimized
                  />
                  <span className="hidden md:inline md:font-manrope md:text-base md:font-medium md:leading-normal md:tracking-[-0.72px] md:text-lg">Buscar</span>
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
