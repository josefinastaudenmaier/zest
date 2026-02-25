"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fefbf7", color: "#1a1a1a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>
            {error.message || "Ocurrió un error inesperado."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="font-manrope"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.75rem",
              fontWeight: 500,
              lineHeight: "normal",
              letterSpacing: "-0.72px",
              backgroundColor: "#ec751a",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
