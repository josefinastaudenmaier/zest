"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-bold text-gray-900">
        Algo salió mal
      </h1>
      <p className="mb-6 text-gray-600">
        {error.message || "Ocurrió un error inesperado."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="font-manrope rounded-xl bg-primary-500 px-4 py-2 font-medium leading-normal text-white tracking-[-0.72px] hover:bg-primary-600"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="font-manrope rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium leading-normal text-gray-700 tracking-[-0.72px] hover:bg-gray-50"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
