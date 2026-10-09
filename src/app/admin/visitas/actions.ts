"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zOptLocalDateTime, zOptText, zUuid } from "@/lib/admin/form";
import { fail, ok, staffCtx } from "@/lib/admin/server";
import { localDateTimeToIso } from "@/lib/format";

const MESSAGES: Record<string, string> = {
  confirmar: "Visita confirmada. Se notificó al cliente.",
  cancelar: "Visita cancelada.",
  reprogramar: "Visita reprogramada.",
  completar: "Visita marcada como completada.",
  no_asistio: "Registrado: el cliente no asistió.",
};

export async function updateAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/visitas");
  const f = parseForm(z.object({
    id: zUuid,
    op: z.enum(["confirmar", "cancelar", "reprogramar", "completar", "no_asistio"], { error: "Acción no válida" }),
    new_start: zOptLocalDateTime,
    reason: zOptText(500),
  }).refine((d) => d.op !== "cancelar" || Boolean(d.reason && d.reason.length >= 3), { message: "Indique el motivo de la cancelación", path: ["reason"] })
    .refine((d) => d.op !== "reprogramar" || Boolean(d.new_start), { message: "Indique la nueva fecha y hora", path: ["new_start"] }), fd);
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
