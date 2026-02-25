import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase y actualiza las cookies para que
 * las API routes (ej. /api/favoritos) puedan leer getUser() correctamente.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          const defaultOptions = { path: "/" as const };
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...defaultOptions, ...(options as object) })
          );
        },
      },
    }
  );

  // Refresca el token; si no se llama, la sesión puede no estar disponible en API routes
  await supabase.auth.getUser();

  return response;
}
