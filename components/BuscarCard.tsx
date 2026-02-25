"use client";

import { useState, useEffect } from "react";
import { getPlacePhotoUrl } from "@/lib/places";

const CHIP_ICONS: Record<string, React.ReactNode> = {
  calendar: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  coffee: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  wifi: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  terraza: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-8" />
      <path d="M5 14v4h14v-4" />
      <path d="M5 14l2-6 5 2 5-2 2 6" />
      <path d="M12 8l-2-4-2 4 2 2 2-2z" />
    </svg>
  ),
  tranquilo: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 6c-1.5 0-3 1.5-3 4 0 2 1.5 3 3 3" />
      <path d="M7 6c1.5 0 3 1.5 3 4 0 2-1.5 3-3 3" />
      <path d="M12 2v20" />
    </svg>
  ),
  movido: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  pet: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 12c0-1.5.5-2.5 1.5-2.5s1.5 1 1.5 2.5-.5 2.5-1.5 2.5-1.5-1-1.5-2.5Z" />
      <path d="M12.5 6c.8 0 1.5-.7 1.5-1.5S13.3 3 12.5 3 11 3.7 11 4.5 11.7 6 12.5 6Z" />
      <path d="M15 8.5c.5.5 1 1.5 1 3s-.5 2.5-1 3" />
      <path d="M9 8.5c-.5.5-1 1.5-1 3s.5 2.5 1 3" />
      <path d="M7 15c-1.5 0-2.5 1.5-2.5 3 0 1.5 1 3 2.5 3s2.5-1.5 2.5-3c0-1.5-1-3-2.5-3Z" />
      <path d="M17 15c1.5 0 2.5 1.5 2.5 3 0 1.5-1 3-2.5 3s-2.5-1.5-2.5-3c0-1.5 1-3 2.5-3Z" />
    </svg>
  ),
  precio: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

export type ChipItem = { label: string; icon: string };

function getCategoryFromTypes(types: string[] | undefined): string {
  if (!types?.length) return "LUGAR";
  const t = types.join(" ").toLowerCase();
  if (t.includes("cafe") || t.includes("coffee")) return "CAFÉ";
  if (t.includes("restaurant") || t.includes("meal")) return "RESTAURANTE";
  if (t.includes("bar")) return "BAR";
  if (t.includes("bakery")) return "PANADERÍA";
  return types[0]?.replace(/_/g, " ").toUpperCase().slice(0, 12) || "LUGAR";
}

type BuscarCardProps = {
  placeId: string;
  name: string;
  category: string;
  /** Ciudad (solo se muestra si pais !== "AR") */
  ciudad?: string | null;
  /** Código país (ej. "AR"). Si no es "AR", se muestra ciudad y país */
  pais?: string | null;
  /** Rating personal de Josefina (estrellas) */
  rating?: number | null;
  photoReference?: string | null;
  photoUrl?: string;
  /** Para fallback de foto vía Places API: nombre + lat/lng */
  lat?: number | null;
  lng?: number | null;
  google_maps_url: string;
  isFav: boolean;
  onToggleFav: (e: React.MouseEvent) => void;
  favLoading?: boolean;
  chips: ChipItem[];
};

export function BuscarCard({
  placeId,
  name,
  category,
  ciudad,
  pais,
  rating,
  photoReference,
  photoUrl,
  lat,
  lng,
  google_maps_url,
  isFav,
  onToggleFav,
  favLoading,
  chips,
}: BuscarCardProps) {
  const [fetchedPhotoUrl, setFetchedPhotoUrl] = useState<string | null>(null);
  const imgSrc =
    photoUrl ??
    (photoReference ? getPlacePhotoUrl(photoReference, 400) : null) ??
    fetchedPhotoUrl;
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imgSrc]);

  useEffect(() => {
    if (fetchedPhotoUrl || photoUrl || photoReference) return;
    if (!name?.trim()) return;
    const params = new URLSearchParams({ name: name.trim() });
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      params.set("lat", String(lat));
      params.set("lng", String(lng));
    }
    fetch(`/api/places/photo?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { photo_url?: string | null }) => {
        if (data.photo_url) setFetchedPhotoUrl(data.photo_url);
      })
      .catch(() => {});
  }, [name, lat, lng, photoUrl, photoReference, fetchedPhotoUrl]);

  const showCityCountry = pais != null && String(pais).toUpperCase() !== "AR" && (ciudad?.trim() || pais?.trim());
  const mapsHref = google_maps_url?.trim() || "#";

  return (
    <div className="relative flex w-full flex-col items-start overflow-hidden rounded-[30px] border border-[#f7f3f1] bg-gradient-to-b from-[#fafafa] to-white pb-[24px] gap-4">
      {/* Imagen: h 200px, solo esquinas superiores 24px (Figma 45:295) */}
      <div className="relative h-[200px] w-full shrink-0 overflow-hidden rounded-tl-[24px] rounded-tr-[24px] bg-[#d9d9d9]">
        {imgSrc && !imageError ? (
          <img
            src={imgSrc}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#152f33]/30">—</div>
        )}
      </div>
      {/* Contenido: gap 8px, px 20px (Figma 45:296) */}
      <div className="relative flex w-full flex-col gap-2 px-5">
        <div className="flex items-center justify-start">
          <p className="font-manrope text-left text-xs font-medium uppercase leading-normal tracking-[0.48px] text-[rgba(21,47,51,0.5)]">
            {category}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-manrope text-lg font-medium leading-[0] tracking-[-0.72px] text-[#152f33]">
            <span className="leading-[normal]">{name}</span>
            {showCityCountry && (
              <span className="leading-[normal] text-[rgba(21,47,51,0.5)]">
                {" "}
                · {[ciudad?.trim(), pais?.trim()].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
          {rating != null && (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[#152f33]">{CHIP_ICONS.star}</span>
              <span className="font-manrope text-sm font-medium leading-normal tracking-[-0.56px] text-[#152f33]">
                {rating.toFixed(1).replace(".", ",")}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-start">
          {chips.map(({ label, icon }) => (
            <div
              key={label}
              className="flex items-center gap-1 rounded-[1000px] border border-[#191e1f, 0.16] bg-gradient-to-b from-[rgba(108,130,133,0.12)] to-[rgba(25,30,31,0.12)] px-3 py-1.5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#6c8285]">
                {CHIP_ICONS[icon] ?? CHIP_ICONS.wifi}
              </span>
              <span className="font-manrope text-xs font-medium leading-normal tracking-[-0.48px] text-[#6c8285]">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10 rounded-[30px]"
        aria-label={`Abrir ${name} en Google Maps`}
      />
      {/* Botón favoritos (Figma 45:315): right 19.67px, top 19px, p 12px, borde #fcffc3, gradiente */}
      <button
        type="button"
        onClick={onToggleFav}
        disabled={favLoading}
        className="absolute right-[19.67px] top-[19px] z-20 flex h-12 w-12 items-center justify-center rounded-[999px] border border-white/10 bg-gradient-to-b from-[rgba(228,90,255)] to-[rgba(216,48,249)] p-3 disabled:opacity-50"
        aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
      >
        {isFav ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-6 w-6">
            <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function getCategory(types: string[] | undefined): string {
  return getCategoryFromTypes(types);
}
