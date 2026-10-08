import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, hasSupabase } from "../env";

/** Renueva la sesión en cada navegación y redirige rutas privadas sin sesión (comprobación optimista;
 *  la autorización real ocurre en servidor y en la base de datos). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase) return response;

  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && (path.startsWith("/panel") || path.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/cuenta/ingresar";
    url.search = `?siguiente=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
