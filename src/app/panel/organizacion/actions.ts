"use server";
// Gestión de la agencia: datos, miembros y permisos. La base de datos valida permisos (gestor o
// "gestionar miembros") y el máximo de miembros de la licencia.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { hasSupabase } from "@/lib/env";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import { checkbox, optEmail, optText, zodFieldErrors } from "@/lib/listing-editor/schemas";
import { getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.panel.msg;
const F = es.editor.fieldLabels;

const PATH = "/panel/organizacion";

async function managerContext(orgId: unknown) {
  if (!hasSupabase) return { error: M.demo } as const;
  const id = z.uuid().safeParse(orgId);
  if (!id.success) return { error: M.orgInvalid } as const;
  const ctx = await getSellerContext();
  if (!ctx) return { error: M.sessionExpired } as const;
  const m = ctx.memberships.find((x) => x.organization_id === id.data);
  if (!m || !memberCan(m, "manage_members")) return { error: M.orgForbidden } as const;
  return { ctx, orgId: id.data, supabase: await createClient() } as const;
}

const orgSchema = z.object({
  name: z.string({ error: M.orgName }).trim().min(2, M.min2).max(160),
  legal_name: optText(200, F.legalName),
  rnc: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().regex(/^[0-9-]{9,20}$/, M.rncInvalid).nullable()),
  phone: optText(40, F.phone),
  email: optEmail,
});

export async function updateOrganization(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updateOrganizationEs(_prev, fd), await getLocale());
}
async function updateOrganizationEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await managerContext(fd.get("org_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const r = orgSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.reviewFields, errors: zodFieldErrors(r.error) };
  const { data, error } = await auth.supabase.from("organizations").update(r.data).eq("id", auth.orgId).select("id");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length) return { status: "error", message: M.notSaved };
  revalidatePath(PATH);
  return { status: "ok", message: M.orgOk };
}

const permsSchema = z.object({
  member_role: z.enum(["gestor", "agente"], { error: M.roleInvalid }),
  can_publish: checkbox,
  can_view_all_listings: checkbox,
  can_manage_members: checkbox,
  can_view_leads: checkbox,
});

export async function addMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await addMemberEs(_prev, fd), await getLocale());
}
async function addMemberEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await managerContext(fd.get("org_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const raw = formToObject(fd);
  const email = z.email(M.emailInvalid).max(160).safeParse(String(raw.email ?? "").trim().toLowerCase());
  const perms = permsSchema.safeParse(raw);
  if (!email.success || !perms.success) {
    return {
      status: "error",
      message: M.reviewFields,
      errors: { ...(email.success ? {} : { email: M.emailInvalid }), ...(perms.success ? {} : zodFieldErrors(perms.error)) },
    };
  }
  const p = perms.data;
  const { data, error } = await auth.supabase.rpc("add_org_member_by_email", {
    p_org: auth.orgId,
    p_email: email.data,
    p_member_role: p.member_role,
    p_can_publish: p.can_publish,
    p_can_view_all: p.can_view_all_listings,
    p_can_manage: p.can_manage_members,
    p_can_view_leads: p.can_view_leads,
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (data !== true) {
    // Mensaje genérico: no revela si el correo tiene cuenta en MAJ.
    return {
      status: "error",
      message: M.memberAddFailed,
    };
  }
  revalidatePath(PATH);
  return { status: "ok", message: M.memberAdded };
}

async function otherManagers(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, userId: string) {
  const { data } = await supabase.rpc("org_member_directory", { p_org: orgId });
  return ((data ?? []) as { user_id: string; member_role: string; can_manage_members: boolean }[]).filter(
    (m) => m.user_id !== userId && (m.member_role === "gestor" || m.can_manage_members),
  ).length;
}

export async function updateMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updateMemberEs(_prev, fd), await getLocale());
}
async function updateMemberEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await managerContext(fd.get("org_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const raw = formToObject(fd);
  const uid = z.uuid().safeParse(raw.user_id);
  const perms = permsSchema.safeParse(raw);
  if (!uid.success || !perms.success) return { status: "error", message: M.dataInvalid };
  const p = perms.data;
  const stillManager = p.member_role === "gestor" || p.can_manage_members;
  if (!stillManager && (await otherManagers(auth.supabase, auth.orgId, uid.data)) === 0) {
    return { status: "error", message: M.keepManager };
  }
  const { data, error } = await auth.supabase
    .from("organization_members")
    .update(p)
    .eq("organization_id", auth.orgId)
    .eq("user_id", uid.data)
    .select("user_id");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length) return { status: "error", message: M.memberNotFound };
  revalidatePath(PATH);
  return { status: "ok", message: M.permsOk };
}

export async function removeMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await removeMemberEs(_prev, fd), await getLocale());
}
async function removeMemberEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await managerContext(fd.get("org_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const uid = z.uuid().safeParse(fd.get("user_id"));
  if (!uid.success) return { status: "error", message: M.dataInvalid };
  if ((await otherManagers(auth.supabase, auth.orgId, uid.data)) === 0) {
    const { data: target } = await auth.supabase.rpc("org_member_directory", { p_org: auth.orgId });
    const t = ((target ?? []) as { user_id: string; member_role: string; can_manage_members: boolean }[]).find((m) => m.user_id === uid.data);
    if (t && (t.member_role === "gestor" || t.can_manage_members)) {
      return { status: "error", message: M.onlyManager };
    }
  }
  const { data, error } = await auth.supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", auth.orgId)
    .eq("user_id", uid.data)
    .select("user_id");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length) return { status: "error", message: M.memberNotFound };
  revalidatePath(PATH);
  return { status: "ok", message: M.memberRemoved };
}
