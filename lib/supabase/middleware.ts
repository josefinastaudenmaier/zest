import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase y actualiza las cookies para que
 * las API routes (ej. /api/favoritos) puedan leer getUser() correctamente.
 */
export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    if (!callbackUrl.searchParams.get("next")) {
      callbackUrl.searchParams.set("next", "/buscar");
    }
    return NextResponse.redirect(callbackUrl);
  }

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname === "/" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/buscar";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value, { path: "/" });
    });
    return redirectResponse;
  }

  return response;
}
