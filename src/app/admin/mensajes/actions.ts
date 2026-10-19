"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zReason, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

export async function hideMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await hideMessageEs(_p, fd), await getLocale());
}
async function hideMessageEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, conversation_id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("messages").update({ hidden: true, hidden_reason: f.data.reason })
    .eq("id", f.data.id).eq("conversation_id", f.data.conversation_id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return confirmRows(res, M.messageHidden);
}

export async function unhideMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await unhideMessageEs(_p, fd), await getLocale());
}
async function unhideMessageEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, conversation_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("messages").update({ hidden: false, hidden_reason: null })
    .eq("id", f.data.id).eq("conversation_id", f.data.conversation_id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return confirmRows(res, M.messageVisible);
}

export async function resolveMessageReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await resolveMessageReportEs(_p, fd), await getLocale());
}
async function resolveMessageReportEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid, status: z.enum(["resuelto", "descartado"], { error: M.invalidStatus }), resolution: zText(2000, 3, M.resolutionRequired),
    back: z.string().regex(/^\/admin\/[\w/-]*$/).optional(),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("message_reports")
    .update({ status: f.data.status, resolution: f.data.resolution, resolved_by: user.id })
    .eq("id", f.data.id).eq("status", "abierto").select("id");
  revalidatePath(f.data.back ?? "/admin/reportes");
  return confirmRows(res, M.reportClosed);
}

export async function setConversationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setConversationStatusEs(_p, fd), await getLocale());
}
async function setConversationStatusEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["abierta", "cerrada", "bloqueada"], { error: M.invalidStatus }) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("conversations").update({ status: f.data.status }).eq("id", f.data.id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.id}`);
  return confirmRows(res, M.convStatusUpdated);
}

export async function staffReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await staffReplyEs(_p, fd), await getLocale());
}
async function staffReplyEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({ conversation_id: zUuid, body: zText(4000, 1, M.writeMessage) }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("messages").insert({ conversation_id: f.data.conversation_id, sender_id: user.id, body: f.data.body });
  if (error) return fail(error);
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return ok(M.messageSent);
}
