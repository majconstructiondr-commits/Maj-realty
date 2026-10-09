"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage } from "@/lib/security";

const commentSchema = z.object({
  request_id: z.uuid(),
  body: z.string().trim().min(1, "Escriba su comentario").max(4000, "Máximo 4000 caracteres"),
});

/** Comentario visible para el equipo y el cliente (nunca privado desde el panel del cliente). */
export async function addRequestComment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = commentSchema.safeParse({ request_id: fd.get("request_id"), body: fd.get("body") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message, errors: { body: parsed.error.issues[0].message } };
  const { error } = await ctx.supabase.rpc("add_request_note", { p_request: parsed.data.request_id, p_body: parsed.data.body, p_private: false });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(`/panel/solicitudes/${parsed.data.request_id}`);
  return { status: "ok", message: "Comentario agregado al historial." };
}

/** Abre (o reutiliza) la conversación de la solicitud y lleva al chat. */
export async function startRequestChat(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const id = z.uuid().safeParse(fd.get("request_id"));
  if (!id.success) return { status: "error", message: "Solicitud no válida." };
  const { data: req } = await ctx.supabase.from("service_requests").select("number").eq("id", id.data).maybeSingle();
  if (!req) return { status: "error", message: "Solicitud no encontrada." };
  const { data, error } = await ctx.supabase.rpc("start_conversation", {
    p_property: null,
    p_request: id.data,
    p_subject: `Solicitud ${req.number}`,
    p_body: "",
  });
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  redirect(`/panel/mensajes/${data}`);
}
