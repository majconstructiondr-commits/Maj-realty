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

const NO_DB: ActionState = { status: "error", message: "Modo demostración: las cuentas estarán disponibles cuando se configure la base de datos." };
const TOO_MANY: ActionState = { status: "error", message: "Demasiados intentos. Espere unos minutos e intente de nuevo." };

const email = z.string().trim().toLowerCase().max(160, "Correo demasiado largo").pipe(z.email("Correo no válido"));
const password = z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(72, "Máximo 72 caracteres");

// ---------------------------------------------------------------------------
// Ingresar
// ---------------------------------------------------------------------------
export async function signIn(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const ip = await clientIpHash();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) return TOO_MANY;
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { status: "error", message: "Indique su correo y contraseña." };
  if (!rateLimit(`login-mail:${parsed.data.email}`, 8, 15 * 60 * 1000)) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensaje genérico: no revela si el correo existe o si falta confirmarlo.
    return { status: "error", message: "No pudimos iniciar sesión. Verifique sus datos o confirme su correo con el enlace que le enviamos." };
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
  full_name: z.string().trim().min(2, "Indique su nombre").max(160, "Máximo 160 caracteres"),
  email,
  password,
  password_confirm: z.string(),
  accept_terms: z.literal("on", { error: "Debe aceptar los términos y la política de privacidad" }),
}).refine((d) => d.password === d.password_confirm, { message: "Las contraseñas no coinciden", path: ["password_confirm"] });

export async function signUp(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  if (!(await checkHuman(fd))) return { status: "error", message: "No pudimos verificar el envío. Espere unos segundos e intente de nuevo." };
  const ip = await clientIpHash();
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) return TOO_MANY;
  const parsed = signUpSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "_");
      errors[k] ??= i.message;
    }
    return { status: "error", message: "Revise los campos marcados.", errors };
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
      return { status: "error", message: "La contraseña es demasiado débil. Use una más larga y difícil de adivinar.", errors: { password: "Contraseña débil" } };
    }
    if (error.status === 429) return TOO_MANY;
    if (error.code !== "user_already_exists" && error.code !== "email_exists") {
      // Sin el correo: solo el código, para poder diagnosticar en los registros de Vercel.
      console.error("signUp falló", { code: error.code, status: error.status });
      return { status: "error", message: "No pudimos completar el registro. Intente de nuevo en unos minutos." };
    }
  }
  // Mismo mensaje exista o no la cuenta.
  return {
    status: "ok",
    message: "Si el correo puede registrarse, le enviamos un enlace de confirmación. Ábralo para activar su cuenta (revise también la carpeta de spam).",
  };
}

// ---------------------------------------------------------------------------
// Recuperar contraseña
// ---------------------------------------------------------------------------
export async function requestPasswordReset(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  if (!(await checkHuman(fd))) return { status: "error", message: "No pudimos verificar el envío. Espere unos segundos e intente de nuevo." };
  const ip = await clientIpHash();
  if (!rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000)) return TOO_MANY;
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { status: "error", message: "Indique un correo válido.", errors: { email: "Correo no válido" } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/cuenta/nueva-clave`,
  });
  if (error && error.status === 429) return TOO_MANY;
  return { status: "ok", message: "Si existe una cuenta con ese correo, le enviamos un enlace para crear una nueva contraseña." };
}

// ---------------------------------------------------------------------------
// Nueva contraseña (con sesión iniciada mediante el enlace de recuperación)
// ---------------------------------------------------------------------------
export async function updatePassword(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const parsed = z
    .object({ password, password_confirm: z.string() })
    .refine((d) => d.password === d.password_confirm, { message: "Las contraseñas no coinciden", path: ["password_confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0] ?? "password")]: i.message } };
  }
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: "Su enlace venció. Solicite uno nuevo desde «Recuperar contraseña»." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { status: "error", message: "La nueva contraseña debe ser distinta de la anterior." };
    if (error.code === "weak_password") return { status: "error", message: "La contraseña es demasiado débil." };
    if (error.code === "insufficient_aal") {
      return { status: "error", message: "Antes de cambiar la contraseña verifique su segundo factor en Seguridad." };
    }
    if (error.code === "reauthentication_needed") return { status: "error", message: "Por seguridad, inicie sesión de nuevo y vuelva a intentarlo." };
    return { status: "error", message: "No se pudo cambiar la contraseña. Intente de nuevo." };
  }
  return { status: "ok", message: "Contraseña actualizada correctamente." };
}

// ---------------------------------------------------------------------------
// Segundo factor (TOTP)
// ---------------------------------------------------------------------------
export type EnrollState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "enrolled"; factorId: string; qr: string; secret: string };

export async function enrollTotp(): Promise<EnrollState> {
  if (!hasSupabase) return { status: "error", message: "Modo demostración." };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: "Su sesión venció. Inicie sesión de nuevo." };
  // Limpia factores sin verificar de intentos anteriores.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { status: "error", message: "No se pudo iniciar la configuración del segundo factor. Intente de nuevo." };
  const qr = qrImageSrc(data.totp.qr_code);
  return { status: "enrolled", factorId: data.id, qr, secret: data.totp.secret };
}

export async function verifyTotp(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: "Su sesión venció. Inicie sesión de nuevo." };
  if (!rateLimit(`mfa:${u.user.id}`, 10, 10 * 60 * 1000)) return TOO_MANY;
  const factorId = z.uuid().safeParse(fd.get("factor_id"));
  const code = normalizeTotp(fd.get("code"));
  if (!factorId.success) return { status: "error", message: "Factor no válido." };
  if (!code) return { status: "error", message: "Escriba el código de 6 dígitos de su aplicación.", errors: { code: "Código de 6 dígitos" } };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (!factors?.all.some((f) => f.id === factorId.data)) return { status: "error", message: "Factor no válido." };
  const ch = await supabase.auth.mfa.challenge({ factorId: factorId.data });
  if (ch.error || !ch.data) return { status: "error", message: "No se pudo verificar el código. Intente de nuevo." };
  const v = await supabase.auth.mfa.verify({ factorId: factorId.data, challengeId: ch.data.id, code });
  if (v.error) return { status: "error", message: "Código incorrecto o vencido. Use el código actual de su aplicación.", errors: { code: "Código incorrecto" } };
  const next = fd.get("siguiente");
  redirect(typeof next === "string" && next ? safeNext(next, "/panel") : "/cuenta/seguridad?aviso=verificado");
}

export async function removeFactor(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return NO_DB;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { status: "error", message: "Su sesión venció. Inicie sesión de nuevo." };
  const factorId = z.uuid().safeParse(fd.get("factor_id"));
  if (!factorId.success) return { status: "error", message: "Factor no válido." };
  if (fd.get("confirm") !== "on") return { status: "error", message: "Marque la casilla para confirmar." };
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factorId.data });
  if (error) {
    return { status: "error", message: "No se pudo eliminar el factor. Verifique primero su código (sesión reforzada) e intente de nuevo." };
  }
  revalidatePath("/cuenta/seguridad");
  return { status: "ok", message: "Factor eliminado." };
}
