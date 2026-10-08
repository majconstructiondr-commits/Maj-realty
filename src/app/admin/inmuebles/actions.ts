"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/admin/labels";
import { parseForm, zBool, zDate, zEnumOf, zOptText, zOptUuid, zReason, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";

const path = (id: string) => `/admin/inmuebles/${id}`;

export async function approveProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "publicado" })
    .eq("id", f.data.id).in("status", ["en_revision", "pausado", "rechazado", "reservado"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Publicación aprobada y visible en el catálogo (si su licencia está vigente).");
}

export async function rejectProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "rechazado", rejection_reason: f.data.reason })
    .eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Publicación rechazada. El motivo queda en el historial.");
}

export async function pauseProperty(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ status: "pausado", pause_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["publicado", "reservado", "en_revision"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Publicación pausada.");
}

/** Estados de cierre o archivo confirmados por el personal (cuentan como cierres confirmados). */
export async function setPropertyStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["reservado", "vendido", "rentado", "archivado"], { error: "Estado no válido" }), reason: zOptText(500) }), fd);
  if (!f.ok) return f.state;
  const patch: Record<string, unknown> = { status: f.data.status };
  if (f.data.reason) patch.pause_reason = f.data.reason;
  const res = await supabase.from("properties").update(patch).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Estado actualizado.");
}

export async function markDocumentsReviewed(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid,
    reviewed_at: zDate,
    scope: zText(300, 10, "Describa el alcance de la revisión (mínimo 10 caracteres)"),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties")
    .update({ documents_reviewed_at: f.data.reviewed_at, documents_review_scope: f.data.scope })
    .eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Revisión documental registrada.");
}

export async function clearDocumentsReviewed(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ documents_reviewed_at: null, documents_review_scope: null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Marca de revisión documental retirada.");
}

export async function setAdvisor(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, advisor_id: zOptUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ advisor_id: f.data.advisor_id ?? null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.advisor_id ? "Asesor asignado." : "Asesor retirado.");
}

export async function setMajListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, value: zBool }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("properties").update({ is_maj_listing: f.data.value }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.value ? "Marcada como publicación propia de MAJ." : "Ya no es publicación propia de MAJ.");
}

export async function saveStaffNotes(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, staff_notes: zOptText(4000) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("property_private").update({ staff_notes: f.data.staff_notes ?? null }).eq("property_id", f.data.id).select("property_id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Notas internas guardadas.");
}

export async function reviewDocument(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid, property_id: zUuid, review_status: z.enum(["revisado", "observado"], { error: "Estado no válido" }), review_notes: zOptText(2000),
  }).refine((d) => d.review_status !== "observado" || Boolean(d.review_notes && d.review_notes.length >= 3), {
    message: "Indique la observación", path: ["review_notes"],
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("property_documents")
    .update({ review_status: f.data.review_status, review_notes: f.data.review_notes ?? null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", f.data.id).eq("property_id", f.data.property_id).select("id");
  revalidatePath(path(f.data.property_id));
  return confirmRows(res, f.data.review_status === "revisado" ? "Documento marcado como revisado." : "Observación registrada.");
}

export async function approveMedia(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ property_id: zUuid, media_id: zOptUuid }), fd);
  if (!f.ok) return f.state;
  let q = supabase.from("property_media").update({ approved: true }).eq("property_id", f.data.property_id).eq("approved", false);
  if (f.data.media_id) q = q.eq("id", f.data.media_id);
  const res = await q.select("id");
  revalidatePath(path(f.data.property_id));
  if (res.error) return fail(res.error);
  if (!res.data?.length) return fail("No había multimedia pendiente.");
  return ok(`${res.data.length} archivo(s) aprobado(s).`);
}

export async function reviewChange(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({
    request_id: zUuid, property_id: zUuid, decision: z.enum(["aprobar", "rechazar"]), reason: zOptText(2000),
  }).refine((d) => d.decision === "aprobar" || Boolean(d.reason && d.reason.length >= 3), {
    message: "Indique el motivo del rechazo", path: ["reason"],
  }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.rpc("review_property_change", {
    p_request: f.data.request_id, p_approve: f.data.decision === "aprobar", p_reason: f.data.reason ?? null,
  });
  if (error) return fail(error);
  revalidatePath(path(f.data.property_id));
  return ok(f.data.decision === "aprobar" ? "Cambios aprobados y aplicados a la publicación." : "Cambios rechazados.");
}

export async function createMajListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    title: zText(140, 5, "El título debe tener al menos 5 caracteres"),
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
