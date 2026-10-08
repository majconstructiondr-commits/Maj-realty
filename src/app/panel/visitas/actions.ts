"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { localDateTimeToIso } from "@/lib/format";
import { isValidSlot } from "@/lib/panel/appointments";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage, rateLimit } from "@/lib/security";
import { getSiteSettings } from "@/lib/site";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elija una fecha");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Elija una hora");

async function checkSlot(d: string, t: string) {
  const s = await getSiteSettings();
  const duration = Number(s["appointments.duration_minutes"]) || 60;
  if (!isValidSlot(s["appointments.hours"], d, t, duration)) return "La hora elegida está fuera del horario de atención.";
  return null;
}

const requestSchema = z.object({
  property_id: z.uuid(),
  date,
  time,
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

export async function requestAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  if (!rateLimit(`appt:${ctx.userId}`, 10, 60 * 60 * 1000)) return { status: "error", message: "Demasiadas solicitudes de visita. Intente más tarde." };
  const parsed = requestSchema.safeParse({
    property_id: fd.get("property_id"),
    date: fd.get("date"),
    time: fd.get("time"),
    notes: fd.get("notes") || undefined,
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0])]: i.message } };
  }
  const slotError = await checkSlot(parsed.data.date, parsed.data.time);
  if (slotError) return { status: "error", message: slotError, errors: { time: slotError } };
  let startsAt: string;
  try {
    startsAt = localDateTimeToIso(`${parsed.data.date}T${parsed.data.time}`);
  } catch {
    return { status: "error", message: "Fecha u hora no válida." };
  }
  const { data, error } = await ctx.supabase.rpc("request_appointment", {
    p_property: parsed.data.property_id,
    p_request: null,
    p_starts_at: startsAt,
    p_notes: parsed.data.notes ?? null,
  });
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/visitas");
  redirect("/panel/visitas?aviso=solicitada");
}

const updateSchema = z.object({
  id: z.uuid(),
  action: z.enum(["confirmar", "cancelar", "reprogramar", "completar", "no_asistio"]),
  reason: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  date: date.optional(),
  time: time.optional(),
});

const OK_MESSAGES: Record<string, string> = {
  confirmar: "Visita confirmada.",
  cancelar: "Visita cancelada.",
  reprogramar: "Visita reprogramada.",
  completar: "Visita marcada como completada.",
  no_asistio: "Se registró que el cliente no asistió.",
};

export async function updateAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = updateSchema.safeParse({
    id: fd.get("id"),
    action: fd.get("action"),
    reason: fd.get("reason") || undefined,
    date: fd.get("date") || undefined,
    time: fd.get("time") || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const d = parsed.data;

  // Comprobación de rol en la interfaz (la base de datos vuelve a verificarlo).
  const { data: appt } = await ctx.supabase.from("appointments").select("id, client_id, agent_id, status").eq("id", d.id).maybeSingle();
  if (!appt) return { status: "error", message: "Cita no encontrada." };
  const isAgent = appt.agent_id === ctx.userId;
  if (["confirmar", "completar", "no_asistio"].includes(d.action) && !isAgent) {
    return { status: "error", message: "Solo el asesor asignado puede realizar esta acción." };
  }

  let newStart: string | null = null;
  if (d.action === "reprogramar") {
    if (!d.date || !d.time) return { status: "error", message: "Elija la nueva fecha y hora." };
    const slotError = await checkSlot(d.date, d.time);
    if (slotError) return { status: "error", message: slotError };
    try {
      newStart = localDateTimeToIso(`${d.date}T${d.time}`);
    } catch {
      return { status: "error", message: "Fecha u hora no válida." };
    }
  }
  if (d.action === "cancelar" && !d.reason) return { status: "error", message: "Indique el motivo de la cancelación." };

  const { error } = await ctx.supabase.rpc("update_appointment", {
    p_id: d.id,
    p_action: d.action,
    p_new_start: newStart,
    p_reason: d.reason ?? null,
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/visitas");
  revalidatePath("/panel");
  const msg = d.action === "reprogramar" && !isAgent ? "Visita reprogramada. El asesor debe confirmar el nuevo horario." : OK_MESSAGES[d.action];
  return { status: "ok", message: msg };
}
