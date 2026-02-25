"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/Providers";
import { getPlacePhotoUrl } from "@/lib/places";

interface FavoritoRow {
  place_id: string;
  name: string | null;
  formatted_address: string | null;
  rating: number | null;
  photo_reference: string | null;
}

export default function FavoritosPage() {
  const { user, loading: authLoading } = useAuth();
  const [favoritos, setFavoritos] = useState<FavoritoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("restauranteReturnPath", "/favoritos");
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setLoading(false);
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
        .then((data) => setFavoritos(data.favoritos ?? []))
        .catch(() => setFavoritos([]))
        .finally(() => setLoading(false));
    }
  }, [user, authLoading]);

  if (authLoading || (user && loading)) {
    return (
      <div className="font-manrope py-12 text-center text-[var(--text-primary)]/70">Cargando favoritos…</div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Favoritos</h1>
        <p className="font-manrope mt-4 text-[var(--text-primary)]/80">
          Iniciá sesión con Google para guardar y ver tus restaurantes favoritos.
        </p>
        <Link
          href="/"
          className="font-manrope mt-6 inline-block text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
        >
          Volver a buscar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Mis favoritos</h1>
      <p className="font-manrope mt-1 text-[var(--text-primary)]/80">
        Restaurantes que guardaste para después.
      </p>
      {favoritos.length === 0 ? (
        <p className="font-manrope mt-8 text-[var(--text-primary)]/70">
          Todavía no tenés favoritos. Buscá un restaurante y guardalo desde su
          ficha.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {favoritos.map((fav) => (
            <li key={fav.place_id}>
              <Link
                href={`/restaurante/${encodeURIComponent(fav.place_id)}`}
                className="card-landing flex gap-4 p-4"
              >
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--text-primary)]/5">
                  {fav.photo_reference ? (
                    <Image
                      src={getPlacePhotoUrl(fav.photo_reference, 200)}
                      alt=""
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-manrope font-semibold text-[var(--text-primary)]">
                    {fav.name ?? "Sin nombre"}
                  </h2>
                  {fav.formatted_address && (
                    <p className="font-manrope truncate text-sm text-[var(--text-primary)]/70">
                      {fav.formatted_address}
                    </p>
                  )}
                  {fav.rating != null && (
                    <span className="font-manrope mt-1 inline-block text-sm text-amber-600">
                      ★ {fav.rating}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/"
        className="font-manrope mt-8 inline-block text-[var(--text-primary)] underline decoration-[var(--text-primary)]/40 hover:decoration-[var(--text-primary)]"
      >
        ← Buscar más restaurantes
      </Link>
    </div>
  );
}
