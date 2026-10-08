import "server-only";
import { getSessionUser, isStaffRole } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";

export const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" };

/** Verificación de personal para rutas API: sesión validada con el servidor de autenticación y MFA (aal2). */
export async function apiStaff() {
  if (!hasSupabase) return { error: new Response("Base de datos no configurada", { status: 503, headers: NO_STORE }) } as const;
  const u = await getSessionUser();
  if (!u) return { error: new Response("No autenticado", { status: 401, headers: NO_STORE }) } as const;
  if (!isStaffRole(u) || u.aal !== "aal2") return { error: new Response("No autorizado", { status: 403, headers: NO_STORE }) } as const;
  return { user: u } as const;
}
