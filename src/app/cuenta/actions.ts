"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { recordTermsAcceptance } from "@/lib/account";
import { env, hasSupabase } from "@/lib/env";
import { checkHuman, clientIpHash, rateLimit } from "@/lib/security";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { normalizeTotp, qrImageSrc } from "@/lib/panel/mfa";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; cada acción los traduce al idioma del visitante al responder.
const M = es.account.msg;

const NO_DB: ActionState = { status: "error", message: M.noDb };
const TOO_MANY: ActionState = { status: "error", message: M.tooMany };

const email = z.string().trim().toLowerCase().max(160, M.emailTooLong).pipe(z.email(M.emailInvalid));
const password = z.string().min(10, M.passwordMin).max(72, M.passwordMax);

// ---------------------------------------------------------------------------
// Ingresar
// ---------------------------------------------------------------------------
export async function signIn(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await signInEs(_p, fd), await getLocale());
}
async function signInEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const ip = await clientIpHash();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) return TOO_MANY;
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { status: "error", message: M.loginMissing };
  if (!rateLimit(`login-mail:${parsed.data.email}`, 8, 15 * 60 * 1000)) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensaje genérico: no revela si el correo existe o si falta confirmarlo.
    return { status: "error", message: M.loginFailed };
  }
  await recordTermsAcceptance(supabase);
  const next = safeNext(fd.get("siguiente"), "/panel");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/cuenta/seguridad?siguiente=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

// ---------------------------------------------------------------------------
// Registro (con verificación de correo obligatoria)
// ---------------------------------------------------------------------------
const signUpSchema = z.object({
  full_name: z.string().trim().min(2, M.name).max(160, M.max160),
  email,
  password,
  password_confirm: z.string(),
  accept_terms: z.literal("on", { error: M.acceptTerms }),
}).refine((d) => d.password === d.password_confirm, { message: M.passwordMismatch, path: ["password_confirm"] });

export async function signUp(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await signUpEs(_p, fd), await getLocale());
}
async function signUpEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  if (!(await checkHuman(fd))) return { status: "error", message: M.humanCheck };
  const ip = await clientIpHash();
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) return TOO_MANY;
  const parsed = signUpSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "_");
      errors[k] ??= i.message;
    }
    return { status: "error", message: M.reviewFields, errors };
  }
  const s = await getSiteSettings();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/confirm`,
      data: {
        full_name: parsed.data.full_name,
        terms_version: String(s["legal.documents_version"] ?? "sin-version"),
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", message: M.weakPasswordLong, errors: { password: M.weakPasswordShort } };
    }
    if (error.status === 429) return TOO_MANY;
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      // Sin el correo: solo el código, para poder diagnosticar en los registros de Vercel.
      console.error("signUp falló", { code: error.code, status: error.status });
      return { status: "error", message: M.signupFailed };
    }
  }
  // Mismo mensaje exista o no la cuenta.
  return {
    status: "ok",
    message: M.signupOk,
  };
}

// ---------------------------------------------------------------------------
// Recuperar contraseña
// ---------------------------------------------------------------------------
export async function requestPasswordReset(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await requestPasswordResetEs(_p, fd), await getLocale());
}
async function requestPasswordResetEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  if (!(await checkHuman(fd))) return { status: "error", message: M.humanCheck };
  const ip = await clientIpHash();
  if (!rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000)) return TOO_MANY;
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { status: "error", message: M.emailRequired, errors: { email: M.emailInvalid } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/cuenta/nueva-clave`,
  });
  if (error && error.status === 429) return TOO_MANY;
  return { status: "ok", message: M.resetOk };
}

// ---------------------------------------------------------------------------
// Nueva contraseña (con sesión iniciada mediante el enlace de recuperación)
// ---------------------------------------------------------------------------
export async function updatePassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updatePasswordEs(_p, fd), await getLocale());
}
async function updatePasswordEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const parsed = z
    .object({ password, password_confirm: z.string() })
    .refine((d) => d.password === d.password_confirm, { message: M.passwordMismatch, path: ["password_confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0] ?? "password")]: i.message } };
  }
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: M.linkExpired };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", message: M.samePassword };
    if (error.code === "weak_password") return { status: "error", message: M.weakPassword };
    if (error.code === "insufficient_aal") {
      return { status: "error", message: M.insufficientAal };
    }
    if (error.code === "reauthentication_needed") return { status: "error", message: M.reauth };
    return { status: "error", message: M.passwordFailed };
  }
  return { status: "ok", message: M.passwordOk };
}

// ---------------------------------------------------------------------------
// Segundo factor (TOTP)
// ---------------------------------------------------------------------------
export type EnrollState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "enrolled"; factorId: string; qr: string; secret: string };

export async function enrollTotp(): Promise<EnrollState> {
  return localizeState(await enrollTotpEs(), await getLocale());
}
async function enrollTotpEs(): Promise<EnrollState> {
  if (!hasSupabase) return { status: "error", message: M.demo };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: M.sessionExpired };
  // Limpia factores sin verificar de intentos anteriores.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { status: "error", message: M.mfaStartFailed };
  const qr = qrImageSrc(data.totp.qr_code);
  return { status: "enrolled", factorId: data.id, qr, secret: data.totp.secret };
}

export async function verifyTotp(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await verifyTotpEs(_p, fd), await getLocale());
}
async function verifyTotpEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: M.sessionExpired };
  if (!rateLimit(`mfa:${u.user.id}`, 10, 10 * 60 * 1000)) return TOO_MANY;
  const factorId = z.uuid().safeParse(fd.get("factor_id"));
  const code = normalizeTotp(fd.get("code"));
  if (!factorId.success) return { status: "error", message: M.invalidFactor };
  if (!code) return { status: "error", message: M.codeMissing, errors: { code: M.codeShort } };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (!factors?.all.some((f) => f.id === factorId.data)) return { status: "error", message: M.invalidFactor };
  const ch = await supabase.auth.mfa.challenge({ factorId: factorId.data });
  if (ch.error || !ch.data) return { status: "error", message: M.codeVerifyFailed };
  const v = await supabase.auth.mfa.verify({ factorId: factorId.data, challengeId: ch.data.id, code });
  if (v.error) return { status: "error", message: M.codeWrong, errors: { code: M.codeWrongShort } };
  const next = fd.get("siguiente");
  redirect(typeof next === "string" && next ? safeNext(next, "/panel") : "/cuenta/seguridad?aviso=verificado");
}

export async function removeFactor(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await removeFactorEs(_p, fd), await getLocale());
}
async function removeFactorEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: M.sessionExpired };
  const factorId = z.uuid().safeParse(fd.get("factor_id"));
  if (!factorId.success) return { status: "error", message: M.invalidFactor };
  if (fd.get("confirm") !== "on") return { status: "error", message: M.confirmCheckbox };
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factorId.data });
  if (error) {
    return { status: "error", message: M.removeFailed };
  }
  revalidatePath("/cuenta/seguridad");
  return { status: "ok", message: M.removed };
}
