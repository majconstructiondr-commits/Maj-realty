"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zReason, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";

export async function hideMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, conversation_id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("messages").update({ hidden: true, hidden_reason: f.data.reason })
    .eq("id", f.data.id).eq("conversation_id", f.data.conversation_id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return confirmRows(res, "Mensaje ocultado para los participantes.");
}

export async function unhideMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, conversation_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("messages").update({ hidden: false, hidden_reason: null })
    .eq("id", f.data.id).eq("conversation_id", f.data.conversation_id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return confirmRows(res, "Mensaje visible de nuevo.");
}

export async function resolveMessageReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid, status: z.enum(["resuelto", "descartado"], { error: "Estado no válido" }), resolution: zText(2000, 3, "Indique la resolución"),
    back: z.string().regex(/^\/admin\/[\w/-]*$/).optional(),
  }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("message_reports")
    .update({ status: f.data.status, resolution: f.data.resolution, resolved_by: user.id })
    .eq("id", f.data.id).eq("status", "abierto").select("id");
  revalidatePath(f.data.back ?? "/admin/reportes");
  return confirmRows(res, "Reporte cerrado con resolución.");
}

export async function setConversationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["abierta", "cerrada", "bloqueada"], { error: "Estado no válido" }) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("conversations").update({ status: f.data.status }).eq("id", f.data.id).select("id");
  revalidatePath(`/admin/mensajes/${f.data.id}`);
  return confirmRows(res, "Estado de la conversación actualizado.");
}

export async function staffReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx();
  const f = parseForm(z.object({ conversation_id: zUuid, body: zText(4000, 1, "Escriba el mensaje") }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("messages").insert({ conversation_id: f.data.conversation_id, sender_id: user.id, body: f.data.body });
  if (error) return fail(error);
  revalidatePath(`/admin/mensajes/${f.data.conversation_id}`);
  return ok("Mensaje enviado en el chat de la página.");
}
