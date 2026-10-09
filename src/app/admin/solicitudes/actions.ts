"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { CRM_STAGES, REQUEST_STATUSES } from "@/lib/admin/labels";
import { parseForm, zBool, zEnumOf, zOptLocalDateTime, zOptText, zOptUuid, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";
import { localDateTimeToIso } from "@/lib/format";

const path = (id: string) => `/admin/solicitudes/${id}`;

export async function updateRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({
    id: zUuid,
    status: zEnumOf(REQUEST_STATUSES),
    stage: zEnumOf(CRM_STAGES),
    assigned_to: zOptUuid,
    assigned_publisher_id: zOptUuid,
    next_action: zOptText(300),
    next_action_at: zOptLocalDateTime,
  }), fd);
  if (!f.ok) return f.state;
  const { id, next_action_at, ...rest } = f.data;
  const res = await supabase.from("service_requests").update({
    ...rest,
    assigned_to: rest.assigned_to ?? null,
    assigned_publisher_id: rest.assigned_publisher_id ?? null,
    next_action: rest.next_action ?? null,
    next_action_at: next_action_at ? localDateTimeToIso(next_action_at) : null,
  }).eq("id", id).select("id");
  revalidatePath(path(id));
  return confirmRows(res, "Solicitud actualizada. Los cambios quedan en el historial.");
}

export async function addRequestNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, body: zText(4000, 2, "Escriba la nota"), visible: zBool }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.rpc("add_request_note", { p_request: f.data.id, p_body: f.data.body, p_private: !f.data.visible });
  if (error) return fail(error);
  revalidatePath(path(f.data.id));
  return ok(f.data.visible ? "Nota visible para el cliente agregada." : "Nota privada agregada.");
}

export async function startRequestConversation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx();
  const f = parseForm(z.object({ id: zUuid, subject: zText(160, 2, "Indique el asunto"), body: zOptText(4000) }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.rpc("start_conversation", {
    p_property: null, p_request: f.data.id, p_subject: f.data.subject, p_body: f.data.body ?? "",
  });
  if (error || !data) return fail(error);
  redirect(`/admin/mensajes/${data}`);
}
