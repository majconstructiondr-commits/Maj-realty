"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zDate, zOptText, zOptUuid, zReason, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, findUserByEmail, staffCtx } from "@/lib/admin/server";
import { addDays, localDayStartIso } from "@/lib/admin/time";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

const path = (id: string) => `/admin/licencias/${id}`;

export async function createLicense(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createLicenseEs(_p, fd), await getLocale());
}
async function createLicenseEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({
    holder_email: z.preprocess((v) => (v === "" ? undefined : v), z.email(M.invalidEmail).optional()),
    organization_id: zOptUuid,
    plan_id: zUuid,
    starts_on: zDate,
    activate: zBool,
  }).refine((d) => Boolean(d.holder_email) !== Boolean(d.organization_id), {
    message: M.userOrOrg, path: ["holder_email"],
  }), fd);
  if (!f.ok) return f.state;
  const { data: plan } = await supabase.from("plans").select("id, holder_type, duration_days, active_listing_quota, max_members, permissions").eq("id", f.data.plan_id).maybeSingle();
  if (!plan) return fail(M.planNotFound);
  if (plan.holder_type === "organizacion" && !f.data.organization_id) return fail(M.planForOrgs);
  if (plan.holder_type === "individual" && !f.data.holder_email) return fail(M.planIndividual);
  let holder: string | null = null;
  if (f.data.holder_email) {
    const r = await findUserByEmail(supabase, f.data.holder_email);
    if (r.error !== undefined) return fail(r.error);
    holder = r.user.id;
  }
  const starts = localDayStartIso(f.data.starts_on);
  const ends = localDayStartIso(addDays(f.data.starts_on, plan.duration_days as number));
  const { data, error } = await supabase.from("licenses").insert({
    holder_user_id: holder,
    organization_id: f.data.organization_id ?? null,
    plan_id: plan.id,
    status: f.data.activate ? "activa" : "pendiente",
    starts_at: starts,
    ends_at: ends,
    active_listing_quota: plan.active_listing_quota,
    max_members: plan.max_members,
    permissions: plan.permissions ?? {},
  }).select("id").single();
  if (error || !data) return fail(error);
  redirect(path(data.id));
}

export async function activateLicense(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await activateLicenseEs(_p, fd), await getLocale());
}
async function activateLicenseEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({ id: zUuid, starts_on: zDate, ends_on: zDate, refresh_quota: zBool })
    .refine((d) => d.ends_on > d.starts_on, { message: M.endAfterStartShort, path: ["ends_on"] }), fd);
  if (!f.ok) return f.state;
  const patch: Record<string, unknown> = {
    status: "activa", starts_at: localDayStartIso(f.data.starts_on), ends_at: localDayStartIso(f.data.ends_on), status_reason: null,
    expiry_notice_sent_at: null,
  };
  if (f.data.refresh_quota) {
    const { data: l } = await supabase.from("licenses").select("plans(active_listing_quota, max_members, permissions)").eq("id", f.data.id).maybeSingle();
    const plan = l?.plans as unknown as { active_listing_quota: number; max_members: number; permissions: unknown } | null;
    if (plan) Object.assign(patch, { active_listing_quota: plan.active_listing_quota, max_members: plan.max_members, permissions: plan.permissions ?? {} });
  }
  const res = await supabase.from("licenses").update(patch).eq("id", f.data.id).in("status", ["pendiente", "suspendida", "vencida", "activa"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.licenseActivated);
}

export async function changeLicenseStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await changeLicenseStatusEs(_p, fd), await getLocale());
}
async function changeLicenseStatusEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["suspendida", "cancelada"], { error: M.invalidStatus }), reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("licenses").update({ status: f.data.status, status_reason: f.data.reason })
    .eq("id", f.data.id).neq("status", "cancelada").select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.status === "suspendida" ? M.licenseSuspended : M.licenseCancelled);
}

export async function reviewLicensePayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await reviewLicensePaymentEs(_p, fd), await getLocale());
}
async function reviewLicensePaymentEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({
    id: zUuid, license_id: zUuid, decision: z.enum(["aprobado", "rechazado"]), reason: zOptText(2000),
  }).refine((d) => d.decision === "aprobado" || Boolean(d.reason && d.reason.length >= 3), { message: M.rejectReason, path: ["reason"] }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("license_payments").update({ status: f.data.decision, review_reason: f.data.reason ?? null })
    .eq("id", f.data.id).eq("license_id", f.data.license_id).eq("status", "pendiente").select("id");
  revalidatePath(path(f.data.license_id));
  revalidatePath("/admin/licencias");
  return confirmRows(res, f.data.decision === "aprobado" ? M.paymentApproved : M.paymentRejected);
}
