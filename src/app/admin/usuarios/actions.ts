"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ORG_STATUSES, ROLES } from "@/lib/admin/labels";
import { parseForm, zBool, zDate, zEnumOf, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";

const path = (id: string) => `/admin/usuarios/${id}`;

export async function grantRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, role: zEnumOf(ROLES) }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.from("user_roles")
    .upsert({ user_id: f.data.user_id, role: f.data.role, granted_by: user.id }, { onConflict: "user_id,role", ignoreDuplicates: true })
    .select("user_id");
  if (error) return fail(error);
  revalidatePath(path(f.data.user_id));
  return ok(data?.length ? `Rol “${ROLES[f.data.role]}” otorgado.` : "El usuario ya tenía ese rol.");
}

export async function revokeRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, role: zEnumOf(ROLES) }), fd);
  if (!f.ok) return f.state;
  if (f.data.user_id === user.id && (f.data.role === "admin" || f.data.role === "staff")) {
    return fail("No puede retirarse a sí mismo el acceso de personal o administrador.");
  }
  const res = await supabase.from("user_roles").delete().eq("user_id", f.data.user_id).eq("role", f.data.role).select("user_id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, `Rol “${ROLES[f.data.role]}” retirado.`);
}

export async function setSuspended(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, suspended: zBool }), fd);
  if (!f.ok) return f.state;
  if (f.data.user_id === user.id) return fail("No puede suspender su propia cuenta.");
  const res = await supabase.from("profiles").update({ is_suspended: f.data.suspended }).eq("id", f.data.user_id).select("id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, f.data.suspended ? "Cuenta suspendida: sus roles quedan sin efecto." : "Suspensión retirada.");
}

export async function setIdentityReview(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({
    user_id: zUuid,
    reviewed_on: zDate,
    scope: zText(300, 10, "Describa qué se verificó (mínimo 10 caracteres)"),
    back: z.string().regex(/^\/admin\/[\w/-]*$/).optional(),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("profiles")
    .update({ identity_reviewed_at: new Date(`${f.data.reviewed_on}T12:00:00-04:00`).toISOString(), identity_review_scope: f.data.scope })
    .eq("id", f.data.user_id).select("id");
  revalidatePath(f.data.back ?? path(f.data.user_id));
  return confirmRows(res, "Revisión de identidad registrada.");
}

export async function clearIdentityReview(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("profiles").update({ identity_reviewed_at: null, identity_review_scope: null }).eq("id", f.data.user_id).select("id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, "Marca de revisión de identidad retirada.");
}

export async function setOrganizationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios/agencias");
  const f = parseForm(z.object({ id: zUuid, status: zEnumOf(ORG_STATUSES) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("organizations").update({ status: f.data.status }).eq("id", f.data.id).select("id");
  revalidatePath("/admin/usuarios/agencias");
  return confirmRows(res, "Estado de la organización actualizado.");
}
