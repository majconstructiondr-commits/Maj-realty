"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zDate, zOptText, zOptUuid, zReason, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, findUserByEmail, staffCtx } from "@/lib/admin/server";
import { addDays, localDayStartIso } from "@/lib/admin/time";

const path = (id: string) => `/admin/licencias/${id}`;

export async function createLicense(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({
    holder_email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Correo no válido").optional()),
    organization_id: zOptUuid,
    plan_id: zUuid,
    starts_on: zDate,
    activate: zBool,
  }).refine((d) => Boolean(d.holder_email) !== Boolean(d.organization_id), {
    message: "Indique un usuario (correo) o una organización, no ambos", path: ["holder_email"],
  }), fd);
  if (!f.ok) return f.state;
  const { data: plan } = await supabase.from("plans").select("id, holder_type, duration_days, active_listing_quota, max_members, permissions").eq("id", f.data.plan_id).maybeSingle();
  if (!plan) return fail("Plan no encontrado.");
  if (plan.holder_type === "organizacion" && !f.data.organization_id) return fail("Este plan es para organizaciones.");
  if (plan.holder_type === "individual" && !f.data.holder_email) return fail("Este plan es individual: indique el correo del titular.");
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
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({ id: zUuid, starts_on: zDate, ends_on: zDate, refresh_quota: zBool })
    .refine((d) => d.ends_on > d.starts_on, { message: "El fin debe ser posterior al inicio", path: ["ends_on"] }), fd);
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
  return confirmRows(res, "Licencia activa con las fechas indicadas. Las publicaciones pausadas deben enviarse de nuevo a revisión.");
}

export async function changeLicenseStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["suspendida", "cancelada"], { error: "Estado no válido" }), reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("licenses").update({ status: f.data.status, status_reason: f.data.reason })
    .eq("id", f.data.id).neq("status", "cancelada").select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.status === "suspendida" ? "Licencia suspendida. Sus publicaciones activas quedaron pausadas." : "Licencia cancelada. Sus publicaciones activas quedaron pausadas.");
}

export async function reviewLicensePayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/licencias");
  const f = parseForm(z.object({
    id: zUuid, license_id: zUuid, decision: z.enum(["aprobado", "rechazado"]), reason: zOptText(2000),
  }).refine((d) => d.decision === "aprobado" || Boolean(d.reason && d.reason.length >= 3), { message: "Indique el motivo del rechazo", path: ["reason"] }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("license_payments").update({ status: f.data.decision, review_reason: f.data.reason ?? null })
    .eq("id", f.data.id).eq("license_id", f.data.license_id).eq("status", "pendiente").select("id");
  revalidatePath(path(f.data.license_id));
  revalidatePath("/admin/licencias");
  return confirmRows(res, f.data.decision === "aprobado" ? "Pago aprobado. Si corresponde, active o renueve la licencia." : "Pago rechazado con motivo.");
}
