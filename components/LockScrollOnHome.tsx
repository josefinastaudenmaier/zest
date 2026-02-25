"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * En la home (/) desactiva el scroll en html y body.
 * En el resto de rutas permite scroll normal.
 */
export function LockScrollOnHome() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (isHome) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [isHome]);

  return null;
}
