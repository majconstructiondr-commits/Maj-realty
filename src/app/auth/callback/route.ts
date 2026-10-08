import { NextResponse, type NextRequest } from "next/server";
import { recordTermsAcceptance } from "@/lib/account";
import { hasSupabase } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** Intercambio de código (flujo PKCE) por una sesión. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const next = safeNext(sp.get("next"), "/panel");
  const fail = NextResponse.redirect(new URL("/cuenta/ingresar?error=enlace", request.url), 303);
  if (!hasSupabase || !code || code.length > 500) return fail;
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail;
  await recordTermsAcceptance(supabase);
  return NextResponse.redirect(new URL(next, request.url), 303);
}
