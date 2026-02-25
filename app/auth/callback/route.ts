import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSetList: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSetList.forEach((c) => cookiesToSet.push(c));
            try {
              cookiesToSetList.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // ignorar en contexto de Route Handler
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const redirectUrl = `${origin}${next}`;
      const response = NextResponse.redirect(redirectUrl);
      const defaultOptions = { path: "/" as const };
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, { ...defaultOptions, ...(options as object) })
      );
      return response;
    }
    console.error("Auth callback error:", error.message);
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
