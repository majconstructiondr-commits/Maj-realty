"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zOptLocalDateTime, zOptText, zUuid } from "@/lib/admin/form";
import { fail, ok, staffCtx } from "@/lib/admin/server";
import { localDateTimeToIso } from "@/lib/format";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

const MESSAGES: Record<string, string> = {
  confirmar: M.visitConfirmed,
  cancelar: M.visitCancelled,
  reprogramar: M.visitRescheduled,
  completar: M.visitCompleted,
  no_asistio: M.visitNoShow,
};

export async function updateAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updateAppointmentEs(_p, fd), await getLocale());
}
async function updateAppointmentEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/visitas");
  const f = parseForm(z.object({
    id: zUuid,
    op: z.enum(["confirmar", "cancelar", "reprogramar", "completar", "no_asistio"], { error: M.invalidAction }),
    new_start: zOptLocalDateTime,
    reason: zOptText(500),
  }).refine((d) => d.op !== "cancelar" || Boolean(d.reason && d.reason.length >= 3), { message: M.cancelReasonRequired, path: ["reason"] })
    .refine((d) => d.op !== "reprogramar" || Boolean(d.new_start), { message: M.newStartRequired, path: ["new_start"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.rpc("update_appointment", {
    p_id: f.data.id,
    p_action: f.data.op,
    p_new_start: f.data.new_start ? localDateTimeToIso(f.data.new_start) : null,
    p_reason: f.data.reason ?? null,
  });
  if (error) return fail(error);
  revalidatePath("/admin/visitas");
  return ok(MESSAGES[f.data.op]);
}
