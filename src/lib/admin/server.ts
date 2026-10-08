import "server-only";
import { hasRole, requireAdmin, requireStaff, type SessionUser } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createClient>>;
type DbError = { message?: string; code?: string } | null | undefined;

/** Personal con MFA + cliente con la sesión del usuario (RLS y MFA también se exigen en la base). */
export async function staffCtx(next = "/admin") {
  const user = await requireStaff(next);
  const supabase = await createClient();
  return { user, supabase, isAdmin: hasRole(user, "admin") };
}

export async function adminCtx(next = "/admin") {
  const user = await requireAdmin(next);
  const supabase = await createClient();
  return { user, supabase, isAdmin: true as const };
}

export const ok = (message: string, id?: string): ActionState => ({ status: "ok", message, id });
export const fail = (e: DbError | string): ActionState => ({
  status: "error",
  message: typeof e === "string" ? e : dbErrorMessage(e),
});

/** Éxito solo si la base devolvió filas afectadas (RLS puede filtrar sin error). */
export function confirmRows(res: { error: DbError; data: unknown[] | null }, message: string, id?: string): ActionState {
  if (res.error) return fail(res.error);
  if (!res.data || res.data.length === 0) return fail("No se encontró el registro o no tiene permiso para modificarlo.");
  return ok(message, id);
}

export type UserLabel = { id: string; full_name: string; email: string | null };

/** Nombre y correo de usuarios (solo personal). */
export async function userLabels(supabase: Db, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const map = new Map<string, UserLabel>();
  if (!unique.length) return map;
  const { data } = await supabase.rpc("staff_user_labels", { p_ids: unique });
  for (const r of (data ?? []) as UserLabel[]) map.set(r.id, r);
  return map;
}

export function labelFor(map: Map<string, UserLabel>, id: string | null | undefined, fallback = "—") {
  if (!id) return fallback;
  const u = map.get(id);
  if (!u) return "Usuario";
  return u.full_name || u.email || "Usuario";
}

/** Personal MAJ (staff/admin) para asignaciones. */
export async function staffMembers(supabase: Db) {
  const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["staff", "admin"]);
  const ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  const labels = await userLabels(supabase, ids);
  return ids.map((id) => ({ id, label: labelFor(labels, id) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Publicadores (vendedor/agencia/propietario) para asignar interesados. */
export async function publisherMembers(supabase: Db) {
  const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "agencia", "propietario"]);
  const ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  const labels = await userLabels(supabase, ids);
  return ids.map((id) => ({ id, label: labelFor(labels, id) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export async function findUserByEmail(supabase: Db, email: string) {
  const { data, error } = await supabase.rpc("staff_find_user", { p_email: email });
  if (error) return { error: dbErrorMessage(error) } as const;
  const row = ((data ?? []) as UserLabel[])[0];
  if (!row) return { error: "No existe una cuenta registrada con ese correo." } as const;
  return { user: row } as const;
}

export async function getSetting<T = unknown>(supabase: Db, key: string): Promise<T | null> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? null) as T | null;
}

/** Ruta segura dentro de un prefijo esperado del almacenamiento (sin "..", sin barras dobles). */
export function safeStoragePath(path: string, prefix: string) {
  return path.startsWith(prefix) && !path.includes("..") && !path.includes("//") && /^[\w./-]+$/.test(path) && path.length <= 400;
}

export type { SessionUser };
