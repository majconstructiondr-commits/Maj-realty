import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "./env";

/** IP del cliente (detrás del proxy de la plataforma) para límites; se guarda solo como hash. */
export async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
  return createHash("sha256").update(`${serverEnv().ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

// Límite simple por instancia (complementa los límites de la base de datos).
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return b.count <= max;
}

/** Verificación anti-bots: campo trampa + tiempo mínimo + Turnstile si está configurado. */
export async function checkHuman(fd: FormData) {
  if (String(fd.get("website") ?? "") !== "") return false; // campo trampa
  const started = Number(fd.get("_t") ?? 0);
  if (!started || Date.now() - started < 2500) return false;
  const secret = serverEnv().turnstileSecret;
  if (!secret) return true;
  const token = String(fd.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = (await r.json()) as { success?: boolean };
    return Boolean(j.success);
  } catch {
    return false;
  }
}

/** Traduce errores de la base de datos a mensajes claros sin filtrar detalles internos. */
export function dbErrorMessage(e: { message?: string; code?: string } | null | undefined) {
  if (!e) return "Ocurrió un error inesperado.";
  if (e.code === "P0001" && e.message) return e.message;
  if (e.code === "42501") return e.message && !/permission denied|row-level/i.test(e.message) ? e.message : "No tiene permiso para esta acción.";
  if (e.code === "23505") return "Ya existe un registro con esos datos.";
  if (e.code === "23514") return "Algún dato no cumple las reglas permitidas. Revise el formulario.";
  return "No se pudo guardar. Intente de nuevo en unos minutos.";
}
