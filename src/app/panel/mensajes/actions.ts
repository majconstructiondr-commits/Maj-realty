"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage, rateLimit } from "@/lib/security";

const MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v !== "" ? v : undefined);

const sendSchema = z
  .object({
    conversation_id: z.uuid(),
    body: z.string().trim().max(4000, "Máximo 4000 caracteres").default(""),
    attachment_path: z.string().max(300).regex(/^[A-Za-z0-9._/-]+$/, "Adjunto no válido").optional(),
    attachment_name: z.string().trim().min(1).max(200).optional(),
    attachment_mime: z.enum(MIMES).optional(),
  })
  .refine((d) => d.body.length > 0 || d.attachment_path, { message: "Escriba un mensaje", path: ["body"] })
  .refine((d) => !d.attachment_path || (d.attachment_path.startsWith(`conversations/${d.conversation_id}/`) && !d.attachment_path.includes("..") && d.attachment_name && d.attachment_mime), {
    message: "Adjunto no válido",
    path: ["attachment_path"],
  });

export async function sendMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  if (!rateLimit(`msg:${ctx.userId}`, 30, 60 * 1000)) return { status: "error", message: "Está enviando mensajes muy rápido. Espere un momento." };
  const parsed = sendSchema.safeParse({
    conversation_id: fd.get("conversation_id"),
    body: opt(fd.get("body")),
    attachment_path: opt(fd.get("attachment_path")),
    attachment_name: opt(fd.get("attachment_name")),
    attachment_mime: opt(fd.get("attachment_mime")),
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0] ?? "body")]: i.message } };
  }
  const d = parsed.data;
  const { data, error } = await ctx.supabase
    .from("messages")
    .insert({
      conversation_id: d.conversation_id,
      sender_id: ctx.userId,
      body: d.body || `Archivo adjunto: ${d.attachment_name}`,
      attachment_path: d.attachment_path ?? null,
      attachment_name: d.attachment_path ? d.attachment_name : null,
      attachment_mime: d.attachment_path ? d.attachment_mime : null,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(`/panel/mensajes/${d.conversation_id}`);
  revalidatePath("/panel/mensajes");
  return { status: "ok", message: "Mensaje enviado.", id: data.id };
}

export async function markConversationRead(conversationId: string) {
  const ctx = await actionContext();
  if (!ctx || !z.uuid().safeParse(conversationId).success) return false;
  const { error } = await ctx.supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  return !error;
}

const reportSchema = z.object({
  message_id: z.uuid(),
  reason: z.string().trim().min(3, "Explique brevemente el motivo (mínimo 3 caracteres)").max(1000, "Máximo 1000 caracteres"),
});

export async function reportMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = reportSchema.safeParse({ message_id: fd.get("message_id"), reason: fd.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const { error } = await ctx.supabase.from("message_reports").insert({ ...parsed.data, reporter_id: ctx.userId });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Ya reportó este mensaje. El equipo de MAJ lo está revisando." };
    return { status: "error", message: dbErrorMessage(error) };
  }
  return { status: "ok", message: "Reporte enviado. El equipo de MAJ lo revisará." };
}

const startSchema = z.object({
  property_id: z.uuid(),
  subject: z.string().trim().min(2, "Indique un asunto").max(160, "Máximo 160 caracteres"),
  body: z.string().trim().min(1, "Escriba su mensaje").max(4000, "Máximo 4000 caracteres"),
});

export async function startPropertyConversation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  if (!rateLimit(`conv:${ctx.userId}`, 10, 60 * 60 * 1000)) return { status: "error", message: "Demasiadas conversaciones nuevas. Intente más tarde." };
  const parsed = startSchema.safeParse({ property_id: fd.get("property_id"), subject: fd.get("subject"), body: fd.get("body") });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0])]: i.message } };
  }
  const { data, error } = await ctx.supabase.rpc("start_conversation", {
    p_property: parsed.data.property_id,
    p_request: null,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
  });
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/mensajes");
  redirect(`/panel/mensajes/${data}`);
}
