"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "./Providers";

export function Header() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRefMobile = useRef<HTMLDivElement>(null);
  const userMenuRefDesktop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideMobile = !userMenuRefMobile.current?.contains(target);
      const outsideDesktop = !userMenuRefDesktop.current?.contains(target);
      if (outsideMobile && outsideDesktop) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  if (pathname === "/") return null;

  const isBuscar = pathname === "/buscar";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const fullName = (user?.user_metadata?.full_name as string) || user?.email || "";

  if (isBuscar) {
    return (
      <header className="sticky top-0 z-50 w-full px-4 pt-4 pb-3 md:pt-6 md:pb-2">
        {/* Mismo estilo que la barra de la home: glass, rounded-full, backdrop-blur */}
        <div className="mx-auto flex w-full max-w-[1300px] flex-wrap items-center justify-between gap-2 rounded-full bg-white/10 px-5 py-3.5 backdrop-blur-md">
          {/* Logo (Figma 38:161): desktop h 30px, w 96.5px */}
          <Link
            href="/"
            className="flex h-8 shrink-0 items-center md:h-[30px] md:w-[96.5px]"
            aria-label="zest club"
          >
            <Image
              src="/logo.png"
              alt="zest club"
              width={97}
              height={30}
              className="h-8 w-auto object-contain object-left md:h-[30px] md:w-auto"
            />
          </Link>

          {/* Mobile (Figma 38:470): Favs + avatar + nombre + chevron */}
          <div className="flex md:hidden items-center gap-6">
            <Link
              href="/favoritos"
              className="font-manrope text-base font-medium leading-normal tracking-[-0.64px] text-[#152f33] hover:opacity-80"
            >
              Favs
            </Link>
            {loading ? (
              <span className="h-6 w-6 animate-pulse rounded-full bg-[#152f33]/10" />
            ) : user ? (
              <div className="relative flex items-center gap-3" ref={userMenuRefMobile}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-3 rounded-full hover:opacity-90"
                >
                  <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-[#d9d9d9]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-medium text-[#152f33]/70">
                        {fullName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="max-w-[100px] truncate font-manrope text-base font-medium leading-normal tracking-[-0.64px] text-[#152f33]">
                    {fullName || "Usuario"}
                  </span>
                  <svg
                    className={`h-6 w-6 flex-shrink-0 text-[#152f33] transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 min-w-[160px] rounded-xl border border-[#152f33]/10 bg-white py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setUserMenuOpen(false);
                      }}
                      className="font-manrope w-full px-4 py-2 text-left text-sm font-medium text-[#152f33] hover:bg-[#152f33]/5"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.85)] to-[rgba(216,48,249,0.85)] px-4 py-2.5 text-sm font-medium leading-normal text-white tracking-[-0.72px] hover:opacity-95"
              >
                Iniciar sesión
              </button>
            )}
          </div>

          {/* Desktop (Figma 38:160): gap 20px, Mis favoritos 18px, bloque usuario gap 12px, avatar 24px, nombre 18px sin cortar, chevron 24px */}
          <div className="hidden md:flex items-center gap-[20px] font-manrope">
            <Link
              href="/favoritos"
              className="shrink-0 font-medium leading-normal text-[18px] text-[#152f33] tracking-[-0.72px] hover:opacity-80"
            >
              Mis favoritos
            </Link>
            {loading ? (
              <span className="text-[18px] text-[#152f33]/50">...</span>
            ) : user ? (
              <div className="relative flex shrink-0 items-center gap-[12px]" ref={userMenuRefDesktop}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-[12px] rounded-full hover:opacity-90"
                >
                  <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-[#d9d9d9]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="24px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-medium text-[#152f33]/70">
                        {fullName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 font-medium leading-normal text-[18px] text-[#152f33] tracking-[-0.72px]">
                    {fullName || "Usuario"}
                  </span>
                  <svg
                    className={`h-6 w-6 flex-shrink-0 text-[#152f33] transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 min-w-[160px] rounded-xl border border-[#152f33]/10 bg-white py-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setUserMenuOpen(false);
                      }}
                      className="font-manrope w-full px-4 py-2 text-left text-sm font-medium text-[#152f33] hover:bg-[#152f33]/5"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="rounded-full bg-gradient-to-b from-[rgba(228,90,255,0.7)] to-[rgba(216,48,249,0.7)] px-5 py-2.5 font-medium leading-normal text-white tracking-[-0.72px] hover:opacity-95"
              >
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-3 pb-2">
      <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-2 rounded-full bg-white/10 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center font-manrope">
          <Link
            href="/"
            className="flex h-[24px] w-auto shrink-0 items-center hover:opacity-90"
            aria-label="zest club"
          >
            <Image
              src="/logo.png"
              alt="zest club"
              width={77}
              height={24}
              className="h-[24px] w-auto object-contain object-left"
            />
          </Link>
        </div>
        <div className="flex items-center gap-3 font-manrope">
          <Link
            href="/favoritos"
            className="text-sm font-medium text-[#282828] opacity-90 hover:opacity-100"
          >
            Favoritos
          </Link>
          {loading ? (
            <span className="text-sm opacity-50">...</span>
          ) : user ? (
            <>
              <span className="max-w-[140px] truncate text-sm text-[#282828] opacity-80">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-full border border-[#282828]/20 bg-white/80 px-4 py-2 text-sm font-medium leading-normal text-[#152f33] tracking-[-0.72px] hover:bg-white/90"
              >
                Salir
              </button>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </header>
  );
}
