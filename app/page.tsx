"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/Providers";

// Asset del diseño Figma (hero)
const IMG_HERO =
  "https://www.figma.com/api/mcp/asset/24a96b45-18b7-4289-ba49-3b6f246a9e56";

export default function HomePage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden rounded-none -mx-4 w-[100vw] max-w-none" style={{ marginLeft: "calc(-50vw + 50%)" }}>
      {/* Background: imagen al 100% del ancho de pantalla */}
      <div className="absolute inset-0 -top-[6rem] w-[100vw] left-1/2 -translate-x-1/2">
        <Image
          src={IMG_HERO}
          alt=""
          fill
          className="object-cover object-[center_12%]"
          priority
          sizes="100vw"
          unoptimized
        />
      </div>

      {/* Gradient overlay bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[171px]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, #a79d61 92.14%)",
        }}
      />

      {/* Centered content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20 text-center">
        <div className="flex w-full max-w-[1008px] -translate-y-[10px] flex-col items-center gap-[32px]">
          <div className="flex flex-col items-center gap-5">
            <h1
              className="font-lora text-center font-medium text-[#282828]"
              style={{
                fontSize: "clamp(2rem, 5vw + 1.5rem, 85px)",
                lineHeight: "1.1",
                letterSpacing: "-3.4px",
              }}
            >
              Decidir dónde{" "}
              <span className="italic">comer</span>
              {" "}nunca fue{" "}
              <span className="italic">tan fácil</span>
            </h1>
            <p className="font-manrope max-w-[692px] font-medium leading-normal text-[#282828] opacity-80 text-[clamp(1rem,2.5vw,24px)] tracking-[-0.04em]">
              Buscá lo que querés en lenguaje natural y recibí opciones claras,
              comparables y listas para reservar. Sin leer cientos de reseñas.
            </p>
          </div>
          {/* Borde con gradiente animado (se mueve) + padding 1px */}
          <span className="cta-stroke-gradient-animate inline-flex rounded-full p-[1px]">
            <Link
              href="/buscar"
              className="group relative inline-flex overflow-hidden rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.7)] to-[rgba(216,48,249,0.7)] font-manrope px-6 py-3 font-medium leading-normal text-white tracking-[-0.72px] transition-all duration-300"
            >
              {/* Pulso sutil desde el borde inferior al hacer hover */}
              <span
                className="absolute inset-x-0 bottom-0 h-full origin-bottom scale-y-0 bg-gradient-to-t from-[rgba(255,255,255,0.18)] via-[rgba(255,200,255,0.08)] to-transparent transition-transform duration-500 ease-in-out group-hover:scale-y-100"
                aria-hidden
              />
              <span className="relative z-10 flex items-center justify-center gap-2.5">
                Encontrar mi próximo spot
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" aria-hidden>
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          </span>
        </div>
      </div>

      {/* Barra tipo glass del diseño */}
      <div className="absolute left-1/2 top-0 z-20 w-full max-w-[1300px] -translate-x-1/2 px-4 pt-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-full bg-white/10 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center font-manrope">
            <Link
              href="/"
              className="flex h-[24px] w-auto shrink-0 items-center hover:opacity-90"
              aria-label="dondecomo"
            >
              <Image
                src="/logo.png"
                alt="dondecomo"
                width={77}
                height={24}
                className="h-[24px] w-auto object-contain object-left"
              />
            </Link>
          </div>
          <div className="flex items-center gap-3 font-manrope">
            {/* Iniciar sesión: borde en gradiente azul + pulso sutil */}
            <span
              className="inline-flex rounded-full p-[1px]"
              style={{
                background: "linear-gradient(135deg, rgba(195,223,255,0.7) 0%, rgba(180,210,220,0.5) 50%, rgba(161,187,190,0.6) 100%)",
              }}
            >
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="group relative inline-flex overflow-hidden rounded-full bg-gradient-to-b from-[rgba(197,224,229,0.7)] to-[rgba(161,187,190,0.7)] px-6 py-3 font-medium leading-normal text-[#152f33] tracking-[-0.72px] transition-all duration-300"
              >
                <span
                  className="absolute inset-x-0 bottom-0 h-full origin-bottom scale-y-0 bg-gradient-to-t from-[rgba(255,255,255,0.2)] via-[rgba(220,240,245,0.1)] to-transparent transition-transform duration-500 ease-in-out group-hover:scale-y-100"
                  aria-hidden
                />
                <span className="relative z-10">Iniciar sesión</span>
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
