"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/admin/labels";
import { parseForm, zBool, zDate, zEnumOf, zOptText, zOptUuid, zReason, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";
import { fmt, localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;
const T = es.admin.tpl;

const path = (id: string) => `/admin/inmuebles/${id}`;

export async function approveProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await approvePropertyEs(_p, fd), await getLocale());
}
async function approvePropertyEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "publicado" })
    .eq("id", f.data.id).in("status", ["en_revision", "pausado", "rechazado", "reservado"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.approved);
}

export async function rejectProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await rejectPropertyEs(_p, fd), await getLocale());
}
async function rejectPropertyEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "rechazado", rejection_reason: f.data.reason })
    .eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.rejected);
}

export async function pauseProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await pausePropertyEs(_p, fd), await getLocale());
}
async function pausePropertyEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "pausado", pause_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["publicado", "reservado", "en_revision"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.paused);
}

/** Estados de cierre o archivo confirmados por el personal (cuentan como cierres confirmados). */
export async function setPropertyStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setPropertyStatusEs(_p, fd), await getLocale());
}
async function setPropertyStatusEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["reservado", "vendido", "rentado", "archivado"], { error: M.invalidStatus }), reason: zOptText(500) }), fd);
  if (!f.ok) return f.state;
  const patch: Record<string, unknown> = { status: f.data.status };
  if (f.data.reason) patch.pause_reason = f.data.reason;
  const res = await supabase.from("properties").update(patch).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.statusUpdated);
}

export async function markDocumentsReviewed(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await markDocumentsReviewedEs(_p, fd), await getLocale());
}
async function markDocumentsReviewedEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid,
    reviewed_at: zDate,
    scope: zText(300, 10, M.scopeMin),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties")
    .update({ documents_reviewed_at: f.data.reviewed_at, documents_review_scope: f.data.scope })
    .eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.docReviewSaved);
}

export async function clearDocumentsReviewed(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await clearDocumentsReviewedEs(_p, fd), await getLocale());
}
async function clearDocumentsReviewedEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ documents_reviewed_at: null, documents_review_scope: null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.docReviewCleared);
}

export async function setAdvisor(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setAdvisorEs(_p, fd), await getLocale());
}
async function setAdvisorEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, advisor_id: zOptUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ advisor_id: f.data.advisor_id ?? null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.advisor_id ? M.advisorSet : M.advisorCleared);
}

export async function setMajListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setMajListingEs(_p, fd), await getLocale());
}
async function setMajListingEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, value: zBool }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ is_maj_listing: f.data.value }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.value ? M.majOn : M.majOff);
}

export async function saveStaffNotes(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await saveStaffNotesEs(_p, fd), await getLocale());
}
async function saveStaffNotesEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, staff_notes: zOptText(4000) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("property_private").update({ staff_notes: f.data.staff_notes ?? null }).eq("property_id", f.data.id).select("property_id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, M.notesSaved);
}

export async function reviewDocument(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await reviewDocumentEs(_p, fd), await getLocale());
}
async function reviewDocumentEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid, property_id: zUuid, review_status: z.enum(["revisado", "observado"], { error: M.invalidStatus }), review_notes: zOptText(2000),
  }).refine((d) => d.review_status !== "observado" || Boolean(d.review_notes && d.review_notes.length >= 3), {
    message: M.observationRequired, path: ["review_notes"],
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("property_documents")
    .update({ review_status: f.data.review_status, review_notes: f.data.review_notes ?? null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", f.data.id).eq("property_id", f.data.property_id).select("id");
  revalidatePath(path(f.data.property_id));
  return confirmRows(res, f.data.review_status === "revisado" ? M.docReviewed : M.observationSaved);
}

export async function approveMedia(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await approveMediaEs(_p, fd), await getLocale());
}
async function approveMediaEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ property_id: zUuid, media_id: zOptUuid }), fd);
  if (!f.ok) return f.state;
  let q = supabase.from("property_media").update({ approved: true }).eq("property_id", f.data.property_id).eq("approved", false);
  if (f.data.media_id) q = q.eq("id", f.data.media_id);
  const res = await q.select("id");
  revalidatePath(path(f.data.property_id));
  if (res.error) return fail(res.error);
  if (!res.data?.length) return fail(M.noPendingMedia);
  return ok(fmt(T.mediaApproved, { n: res.data.length }));
}

export async function reviewChange(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await reviewChangeEs(_p, fd), await getLocale());
}
async function reviewChangeEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({
    request_id: zUuid, property_id: zUuid, decision: z.enum(["aprobar", "rechazar"]), reason: zOptText(2000),
  }).refine((d) => d.decision === "aprobar" || Boolean(d.reason && d.reason.length >= 3), {
    message: M.rejectReason, path: ["reason"],
  }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.rpc("review_property_change", {
    p_request: f.data.request_id, p_approve: f.data.decision === "aprobar", p_reason: f.data.reason ?? null,
  });
  if (error) return fail(error);
  revalidatePath(path(f.data.property_id));
  return ok(f.data.decision === "aprobar" ? M.changesApproved : M.changesRejected);
}

export async function createMajListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createMajListingEs(_p, fd), await getLocale());
}
async function createMajListingEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    title: zText(140, 5, M.titleMin5),
    operation: zEnumOf(OPERATIONS),
    property_type: zEnumOf(PROPERTY_TYPES),
  }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.from("properties")
    .insert({ ...f.data, owner_user_id: user.id, is_maj_listing: true, status: "borrador" })
    .select("id").single();
  if (error || !data) return fail(error);
  redirect(`/panel/publicaciones/${data.id}/editar`);
}
