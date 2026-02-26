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
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
};

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
  /** Reseña personal de Josefina */
  reviewText?: string | null;
  /** Fecha de publicación de la reseña */
  reviewDate?: string | null;
  photoReference?: string | null;
  photoUrl?: string;
  /** Para fallback de foto vía Places API: nombre + lat/lng */
  lat?: number | null;
  lng?: number | null;
  distance_m?: number | null;
  google_maps_url: string;
};

export function BuscarCard({
  placeId,
  name,
  category,
  ciudad,
  pais,
  rating,
  reviewText,
  reviewDate,
  photoReference,
  photoUrl,
  lat,
  lng,
  distance_m,
  google_maps_url,
}: BuscarCardProps) {
  const [fetchedPhotoUrl, setFetchedPhotoUrl] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
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
  const hasReview = Boolean(reviewText?.trim());
  const hasRating = typeof rating === "number" && !Number.isNaN(rating);
  const hasVisited = hasReview && hasRating;
  const distanceKmLabel =
    distance_m != null && !Number.isNaN(distance_m)
      ? `${(distance_m / 1000).toFixed(1).replace(".", ",")} km`
      : null;
  const formattedDate =
    reviewDate && !Number.isNaN(Date.parse(reviewDate))
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date(reviewDate))
      : null;

  return (
    <div className="relative flex w-full self-start flex-col items-start overflow-hidden rounded-[30px] border border-[#f7f3f1] bg-gradient-to-b from-[#fafafa] to-white pb-[24px] gap-5">
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
      <div className="relative flex w-full flex-col gap-2">
        <div className="flex items-center justify-start">
          <p className="px-5 font-manrope text-left text-xs font-medium uppercase leading-normal tracking-[0.48px] text-[rgba(21,47,51,0.5)]">
            {category}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 px-5">
          <p className="font-manrope text-lg font-medium leading-[0] tracking-[-0.72px] text-[#152f33]">
            <span className="leading-[normal]">{name}</span>
            {!hasVisited && distanceKmLabel && (
              <span className="leading-[normal] text-[rgba(21,47,51,0.5)]"> ({distanceKmLabel})</span>
            )}
            {showCityCountry && (
              <span className="leading-[normal] text-[rgba(21,47,51,0.5)]">
                {" "}
                · {[ciudad?.trim(), pais?.trim()].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
          {hasVisited && rating != null && (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[#152f33]">{CHIP_ICONS.star}</span>
              <span className="font-manrope text-sm font-medium leading-normal tracking-[-0.56px] text-[#152f33]">
                {rating.toFixed(1).replace(".", ",")}
              </span>
            </div>
          )}
        </div>
        {!hasVisited && (
          <p className="mt-6 w-full px-5 pb-1 text-center font-manrope text-[14px] font-medium leading-normal tracking-[-0.56px] text-[#152f33]">
            No visitado aún
          </p>
        )}
        {hasVisited && (
          <div className="w-full px-5 pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsReviewOpen(true);
              }}
              className="relative z-20 inline-flex w-full items-center justify-center rounded-[999px] border border-[#c3dfff] bg-gradient-to-b from-[rgba(197,224,229,0.7)] to-[rgba(161,187,190,0.7)] px-6 py-2.5 font-manrope text-sm font-medium leading-normal tracking-[-0.56px] text-[#152f33]"
            >
              <span className="leading-[normal]">Ver reseña</span>
            </button>
          </div>
        )}
      </div>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-10 rounded-[30px]"
        aria-label={`Abrir ${name} en Google Maps`}
      />
      <div
        className={`fixed inset-0 z-[100] flex items-end justify-center bg-[#191e1f]/45 backdrop-blur-[3px] transition-opacity duration-200 md:items-center md:p-6 ${
          isReviewOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsReviewOpen(false);
        }}
      >
        <div
          className={`mb-5 w-[calc(100%-36px)] max-h-[88vh] max-w-[512px] overflow-hidden rounded-[48px] bg-[#fffbf8] px-6 pb-6 pt-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition-all duration-220 md:mb-0 md:rounded-[36px] md:p-6 ${
            isReviewOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.985] opacity-0"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="mx-auto mb-5 h-2 w-[78px] rounded-full bg-[#d9d9d9] md:hidden" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              {formattedDate && (
                <p className="font-manrope text-[13px] uppercase tracking-[0.52px] text-[#8a9699]">
                  {formattedDate}
                </p>
              )}
              <p className="mt-1 truncate font-manrope text-[24px] font-medium leading-[1.05] tracking-[-0.96px] text-[#152f33]">
                {name}
                {distanceKmLabel ? (
                  <span className="font-normal text-[#8a9699]"> ({distanceKmLabel})</span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsReviewOpen(false);
              }}
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8d8d8] text-[#152f33] hover:bg-[#152f33]/5 md:inline-flex"
              aria-label="Cerrar reseña"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative mb-6 rotate-[2deg] overflow-hidden rounded-[24px] border border-[#efe8f4] bg-gradient-to-b from-[#ffffff] to-[#f7f7f7] p-4 md:p-5">
            <svg
              className="pointer-events-none absolute right-[-25.358px] top-[-48.477px] h-[120px] w-[120px] -rotate-[18.112deg] text-[#d46dff] opacity-10"
              viewBox="0 0 120 120"
              fill="currentColor"
              aria-hidden
            >
              <path d="M60 5l15.84 32.09 35.41 5.15-25.62 24.97 6.05 35.27L60 85.84 28.32 102.5l6.05-35.27L8.75 42.24l35.41-5.15L60 5z" />
            </svg>
            {hasRating && (
              <div className="mb-2 flex items-center gap-2 text-[#d46dff]">
                <span className="inline-flex">{CHIP_ICONS.star}</span>
                <span className="font-manrope text-[14px] font-medium leading-none tracking-[-0.56px]">
                  {rating?.toFixed(1).replace(".", ",")}
                </span>
              </div>
            )}
            <p className="max-h-[47vh] overflow-y-auto whitespace-pre-line font-manrope text-[14px] leading-[1.35] tracking-[-0.56px] text-[#152f33] md:text-[15px] md:tracking-[-0.6px]">
              {reviewText}
            </p>
          </div>

          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-[999px] border border-[#c3dfff] bg-gradient-to-b from-[rgba(197,224,229,0.75)] to-[rgba(161,187,190,0.75)] px-6 py-3 font-manrope text-[14px] font-medium tracking-[-0.56px] text-[#152f33]"
            onClick={(e) => e.stopPropagation()}
          >
            Ver en Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}

export function getCategory(types: string[] | undefined): string {
  return getCategoryFromTypes(types);
}
