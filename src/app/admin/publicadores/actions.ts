"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zReason, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

const path = (id: string) => `/admin/publicadores/${id}`;

/** Aprobar: otorga el rol (solo administradores escriben user_roles), activa la organización y cierra la solicitud. */
export async function approveApplication(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await approveApplicationEs(_p, fd), await getLocale());
}
async function approveApplicationEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, isAdmin } = await staffCtx("/admin/publicadores");
  if (!isAdmin) return fail(M.approveOnlyAdmin);
  const f = parseForm(z.object({ id: zUuid, note: z.string().trim().max(2000).optional() }), fd);
  if (!f.ok) return f.state;
  const { data: app } = await supabase.from("publisher_applications").select("id, user_id, applicant_type, organization_id, status").eq("id", f.data.id).maybeSingle();
  if (!app) return fail(M.applicationNotFound);
  if (!["pendiente", "documentos_requeridos"].includes(app.status as string)) return fail(M.alreadyResolved);
  const role = app.applicant_type as "propietario" | "vendedor" | "agencia";
  const g = await supabase.from("user_roles")
    .upsert({ user_id: app.user_id, role, granted_by: user.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (g.error) return fail(g.error);
  if (app.organization_id) {
    const o = await supabase.from("organizations").update({ status: "activa" }).eq("id", app.organization_id).select("id");
    if (o.error || !o.data?.length) return fail(M.orgNotActivated);
  }
  const res = await supabase.from("publisher_applications").update({ status: "aprobada", review_reason: f.data.note || null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  if (res.error || !res.data?.length) return fail(M.notClosed);
  return ok(app.organization_id ? M.approvedOrg : M.approvedOne);
}

export async function requestDocuments(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await requestDocumentsEs(_p, fd), await getLocale());
}
async function requestDocumentsEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/publicadores");
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("publisher_applications").update({ status: "documentos_requeridos", review_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["pendiente", "documentos_requeridos"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.docsRequested);
}

export async function rejectApplication(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await rejectApplicationEs(_p, fd), await getLocale());
}
async function rejectApplicationEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/publicadores");
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("publisher_applications").update({ status: "rechazada", review_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["pendiente", "documentos_requeridos"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.applicationRejected);
}
