"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ORG_STATUSES, ROLES } from "@/lib/admin/labels";
import { parseForm, zBool, zDate, zEnumOf, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";
import { fmt, localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;
const T = es.admin.tpl;

const path = (id: string) => `/admin/usuarios/${id}`;

export async function grantRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await grantRoleEs(_p, fd), await getLocale());
}
async function grantRoleEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, role: zEnumOf(ROLES) }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.from("user_roles")
    .upsert({ user_id: f.data.user_id, role: f.data.role, granted_by: user.id }, { onConflict: "user_id,role", ignoreDuplicates: true })
    .select("user_id");
  if (error) return fail(error);
  revalidatePath(path(f.data.user_id));
  return ok(data?.length ? fmt(T.roleGranted, { role: ROLES[f.data.role] }) : M.alreadyHadRole);
}

export async function revokeRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await revokeRoleEs(_p, fd), await getLocale());
}
async function revokeRoleEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, role: zEnumOf(ROLES) }), fd);
  if (!f.ok) return f.state;
  if (f.data.user_id === user.id && (f.data.role === "admin" || f.data.role === "staff")) {
    return fail(M.cannotRevokeSelf);
  }
  const res = await supabase.from("user_roles").delete().eq("user_id", f.data.user_id).eq("role", f.data.role).select("user_id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, fmt(T.roleRevoked, { role: ROLES[f.data.role] }));
}

export async function setSuspended(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setSuspendedEs(_p, fd), await getLocale());
}
async function setSuspendedEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid, suspended: zBool }), fd);
  if (!f.ok) return f.state;
  if (f.data.user_id === user.id) return fail(M.cannotSuspendSelf);
  const res = await supabase.from("profiles").update({ is_suspended: f.data.suspended }).eq("id", f.data.user_id).select("id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, f.data.suspended ? M.accountSuspended : M.suspensionLifted);
}

export async function setIdentityReview(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setIdentityReviewEs(_p, fd), await getLocale());
}
async function setIdentityReviewEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({
    user_id: zUuid,
    reviewed_on: zDate,
    scope: zText(300, 10, M.identityScopeMin),
    back: z.string().regex(/^\/admin\/[\w/-]*$/).optional(),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("profiles")
    .update({ identity_reviewed_at: new Date(`${f.data.reviewed_on}T12:00:00-04:00`).toISOString(), identity_review_scope: f.data.scope })
    .eq("id", f.data.user_id).select("id");
  revalidatePath(f.data.back ?? path(f.data.user_id));
  return confirmRows(res, M.identityReviewed);
}

export async function clearIdentityReview(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await clearIdentityReviewEs(_p, fd), await getLocale());
}
async function clearIdentityReviewEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios");
  const f = parseForm(z.object({ user_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("profiles").update({ identity_reviewed_at: null, identity_review_scope: null }).eq("id", f.data.user_id).select("id");
  revalidatePath(path(f.data.user_id));
  return confirmRows(res, M.identityCleared);
}

export async function setOrganizationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setOrganizationStatusEs(_p, fd), await getLocale());
}
async function setOrganizationStatusEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/usuarios/agencias");
  const f = parseForm(z.object({ id: zUuid, status: zEnumOf(ORG_STATUSES) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("organizations").update({ status: f.data.status }).eq("id", f.data.id).select("id");
  revalidatePath("/admin/usuarios/agencias");
  return confirmRows(res, M.orgStatusUpdated);
}
