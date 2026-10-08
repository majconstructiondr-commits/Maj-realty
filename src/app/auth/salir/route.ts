import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Cierra la sesión (solo POST, para evitar cierres por enlaces o precarga). */
export async function POST(request: NextRequest) {
  // Protección básica contra envíos desde otros sitios.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    if (originHost !== host) return new NextResponse("Origen no permitido", { status: 403 });
  }
  if (hasSupabase) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
