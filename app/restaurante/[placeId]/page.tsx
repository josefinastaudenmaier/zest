"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPlacePhotoUrl } from "@/lib/places";
import { useAuth } from "@/components/Providers";
import { useToast } from "@/components/ToastContext";
import type { PlaceDetail } from "@/types/places";

export default function RestaurantePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = params.placeId as string;
  const searchQuery = searchParams.get("q") ?? "";
  const { user } = useAuth();
  const { showToast } = useToast();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);
  const [reviewSummaryLoading, setReviewSummaryLoading] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    fetch(`/api/place/${encodeURIComponent(placeId)}`)
      .then(async (res) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error("Respuesta inválida del servidor.");
        }
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlace(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [placeId]);

  useEffect(() => {
    if (!user || !placeId) return;
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
        const ids = (data.favoritos ?? []).map((f: { place_id: string }) => f.place_id);
        setIsFav(ids.includes(placeId));
      })
      .catch(() => {});
  }, [user, placeId]);

  useEffect(() => {
    if (!place?.reviews?.length) return;
    setReviewSummaryLoading(true);
    fetch("/api/resumen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resenas: place.reviews.map((r) => r.text),
        busqueda: searchQuery.trim(),
      }),
    })
      .then((res) => (res.ok ? res.json() : { resumen: null }))
      .then((data: { resumen?: string | null }) => {
        setReviewSummary(data.resumen ?? null);
      })
      .catch(() => setReviewSummary(null))
      .finally(() => setReviewSummaryLoading(false));
  }, [place?.reviews?.length, searchQuery]);

  const toggleFav = async () => {
    if (!user) return;
    setFavLoading(true);
    try {
      if (isFav) {
        const res = await fetch(`/api/favoritos?place_id=${encodeURIComponent(placeId)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) setIsFav(false);
      } else {
        const res = await fetch("/api/favoritos", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: placeId,
            name: place?.name,
            formatted_address: place?.formatted_address,
            rating: place?.rating,
            photo_reference: place?.photos?.[0]?.photo_reference,
          }),
        });
        if (res.ok) {
          setIsFav(true);
          showToast(`${place?.name ?? "Lugar"} agregado a favoritos`);
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
      setFavLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="font-manrope py-12 text-center text-[var(--text-primary)]/70">Cargando…</div>
    );
  }
  const goBack = () => {
    const returnPath =
      (typeof window !== "undefined" && sessionStorage.getItem("restauranteReturnPath")) || "/buscar";
    router.push(returnPath);
  };

  if (error || !place) {
    return (
      <div className="py-12 text-center">
        <p className="font-manrope text-red-600">{error ?? "No se encontró el restaurante."}</p>
        <button
          type="button"
          onClick={goBack}
          className="font-manrope mt-4 inline-block text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
        >
          Volver atrás
        </button>
      </div>
    );
  }

  const photoRef = place.photos?.[0]?.photo_reference;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        type="button"
        onClick={goBack}
        className="font-manrope mb-6 inline-block text-sm text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
      >
        ← Volver atrás
      </button>
      <div className="card-landing overflow-hidden">
        {photoRef && (
          <div className="relative h-56 w-full bg-[var(--text-primary)]/5">
            <Image
              src={getPlacePhotoUrl(photoRef, 800)}
              alt=""
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">{place.name}</h1>
              {place.formatted_address && (
                <p className="font-manrope mt-1 text-[var(--text-primary)]/80">{place.formatted_address}</p>
              )}
            </div>
            {user && (
              <span
                className="inline-flex shrink-0 rounded-full p-[1px]"
                style={{
                  background: "linear-gradient(135deg, rgba(195,223,255,0.7) 0%, rgba(180,210,220,0.5) 50%, rgba(161,187,190,0.6) 100%)",
                }}
              >
                <button
                  type="button"
                  onClick={toggleFav}
                  disabled={favLoading}
                  className="btn-secondary-landing disabled:opacity-60"
                >
                  {isFav ? "★ En favoritos" : "☆ Guardar en favoritos"}
                </button>
              </span>
            )}
          </div>
          <div className="font-manrope mt-4 flex flex-wrap gap-3 text-sm">
            {place.rating != null && (
              <span className="text-amber-600">
                ★ {place.rating}
                {place.user_ratings_total != null &&
                  ` (${place.user_ratings_total} reseñas)`}
              </span>
            )}
            {place.price_level != null && (
              <span className="text-[var(--text-primary)]/80">
                {"$".repeat(place.price_level)}
              </span>
            )}
            {place.opening_hours?.open_now != null && (
              <span
                className={
                  place.opening_hours.open_now ? "text-green-600" : "text-[var(--text-primary)]/60"
                }
              >
                {place.opening_hours.open_now ? "Abierto ahora" : "Cerrado"}
              </span>
            )}
          </div>
          {(place.formatted_phone_number || place.website || place.url) && (
            <div className="mt-6 flex flex-wrap gap-4">
              {place.formatted_phone_number && (
                <a
                  href={`tel:${place.international_phone_number ?? place.formatted_phone_number}`}
                  className="font-manrope text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
                >
                  {place.formatted_phone_number}
                </a>
              )}
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-manrope text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
                >
                  Sitio web
                </a>
              )}
              {place.url && (
                <a
                  href={place.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-manrope text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
                >
                  Ver en Google Maps
                </a>
              )}
            </div>
          )}
          {place.opening_hours?.weekday_text &&
            place.opening_hours.weekday_text.length > 0 && (
              <div className="mt-6">
                <h2 className="font-heading font-semibold text-[var(--text-primary)]">Horarios</h2>
                <ul className="font-manrope mt-2 space-y-1 text-sm text-[var(--text-primary)]/80">
                  {place.opening_hours.weekday_text.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          {place.reviews && place.reviews.length > 0 && (
            <div className="mt-8">
              <h2 className="font-heading font-semibold text-[var(--text-primary)]">Qué dicen los que fueron</h2>
              {reviewSummaryLoading && (
                <p className="font-manrope mt-3 text-sm text-[var(--text-primary)]/60">Generando resumen…</p>
              )}
              {!reviewSummaryLoading && reviewSummary && (
                <div className="card-landing mt-3 border-l-4 border-l-amber-400/80 bg-amber-50/50 p-4">
                  <p className="font-manrope text-[var(--text-primary)] leading-relaxed">{reviewSummary}</p>
                </div>
              )}
              <h3 className="font-heading mt-6 font-semibold text-[var(--text-primary)]">Reseñas</h3>
              <ul className="mt-4 space-y-4">
                {place.reviews.slice(0, 5).map((r, i) => (
                  <li
                    key={i}
                    className="font-manrope border-l-2 border-[var(--text-primary)]/20 pl-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {r.author_name}
                      </span>
                      <span className="text-amber-600">★ {r.rating}</span>
                      <span className="text-[var(--text-primary)]/50">{r.relative_time_description}</span>
                    </div>
                    <p className="mt-1 text-[var(--text-primary)]/80">{r.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
