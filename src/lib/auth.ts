import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { hasSupabase } from "./env";
import { createClient } from "./supabase/server";

export type Role = "cliente" | "propietario" | "vendedor" | "agencia" | "staff" | "admin";
export type SessionUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  fullName: string;
  roles: Role[];
  aal: "aal1" | "aal2";
  /** Tiene un segundo factor registrado */
  hasMfa: boolean;
};

/** Usuario autenticado verificado con el servidor de autenticación (no solo la cookie). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const [{ data: roles }, { data: profile }, { data: aal }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    fullName: profile?.full_name ?? "",
    roles: (roles ?? []).map((r) => r.role as Role),
    aal: (aal?.currentLevel as "aal1" | "aal2") ?? "aal1",
    hasMfa: aal?.nextLevel === "aal2",
  };
});

export function hasRole(u: SessionUser | null, ...roles: Role[]) {
  return Boolean(u && u.roles.some((r) => roles.includes(r)));
}
export const isStaffRole = (u: SessionUser | null) => hasRole(u, "staff", "admin");

export async function requireUser(next = "/panel") {
  const u = await getSessionUser();
  if (!u) redirect(`/cuenta/ingresar?siguiente=${encodeURIComponent(next)}`);
  return u;
}

/** Personal MAJ con segundo factor verificado (la base de datos también lo exige). */
export async function requireStaff(next = "/admin") {
  const u = await requireUser(next);
  if (!isStaffRole(u)) redirect("/panel?aviso=sin-permiso");
  if (u.aal !== "aal2") redirect(`/cuenta/seguridad?siguiente=${encodeURIComponent(next)}&motivo=mfa`);
  return u;
}

export async function requireAdmin(next = "/admin") {
  const u = await requireStaff(next);
  if (!hasRole(u, "admin")) redirect("/admin?aviso=solo-administradores");
  return u;
}
