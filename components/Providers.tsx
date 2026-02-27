"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (nextPath?: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async (nextPath = "/buscar") => {
    try {
      const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

      const normalizeCallbackUrl = (raw: string): string | null => {
        if (!raw) return null;
        try {
          const hasProtocol = /^https?:\/\//i.test(raw);
          const url = new URL(hasProtocol ? raw : `https://${raw}`);
          const path = url.pathname.replace(/\/+$/, "");
          if (path === "/auth/callback") return `${url.origin}/auth/callback`;
          return `${url.origin}/auth/callback`;
        } catch {
          return null;
        }
      };

      const normalizeNextPath = (raw: string): string => {
        const trimmed = raw.trim();
        if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/buscar";
        return trimmed;
      };

      const browserCallback = normalizeCallbackUrl(browserOrigin);
      const envCallback = normalizeCallbackUrl(envSiteUrl);
      const callbackBase = browserCallback ?? envCallback;
      const safeNextPath = normalizeNextPath(nextPath);
      const redirectTo = callbackBase
        ? `${callbackBase}?next=${encodeURIComponent(safeNextPath)}`
        : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });

      if (error) {
        console.error("Google auth error:", error.message);
        return { ok: false, message: "No pudimos iniciar sesión en este momento. Probá de nuevo." };
      }

      if (data?.url && typeof window !== "undefined") {
        window.location.assign(data.url);
      }

      return { ok: true };
    } catch (error) {
      console.error("Google auth unexpected error:", error);
      return { ok: false, message: "Hubo un problema al abrir Google. Intentá nuevamente." };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within Providers");
  return ctx;
}
