import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { recordTermsAcceptance } from "@/lib/account";
import { hasSupabase } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Enlaces de correo (confirmación de alta, recuperación de contraseña, cambio de correo). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tokenHash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/cuenta/nueva-clave" : "/panel";
  const next = safeNext(sp.get("next"), fallback);
  const fail = NextResponse.redirect(new URL("/cuenta/ingresar?error=enlace", request.url), 303);

  if (!hasSupabase) return fail;
  const supabase = await createClient();
  const code = sp.get("code");
  if (!tokenHash && code && code.length <= 500) {
    // Plantillas de correo por defecto (flujo PKCE): llegan con ?code= en lugar de token_hash.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail;
  } else {
    if (!tokenHash || !type || !TYPES.includes(type) || tokenHash.length > 500) return fail;
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail;
  }
  await recordTermsAcceptance(supabase);
  return NextResponse.redirect(new URL(next, request.url), 303);
}
