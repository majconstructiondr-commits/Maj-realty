"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage, rateLimit } from "@/lib/security";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.panel.msg;

const schema = z.object({
  contract_id: z.uuid(),
  title: z.string().trim().min(3, M.ticketTitle).max(160, M.max160),
  description: z.string().trim().max(3000, M.max3000).optional(),
  priority: z.enum(["baja", "normal", "alta", "urgente"]),
});

export async function openTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await openTicketEs(_p, fd), await getLocale());
}
async function openTicketEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  if (!rateLimit(`ticket:${ctx.userId}`, 10, 60 * 60 * 1000)) return { status: "error", message: M.tooManyTickets };
  const parsed = schema.safeParse({
    contract_id: fd.get("contract_id"),
    title: fd.get("title"),
    description: fd.get("description") || undefined,
    priority: fd.get("priority") || "normal",
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { status: "error", message: i.message, errors: { [String(i.path[0])]: i.message } };
  }
  // La interfaz comprueba que el contrato sea propio; RLS lo vuelve a exigir.
  const { data: contract } = await ctx.supabase.from("management_contracts").select("id, owner_user_id").eq("id", parsed.data.contract_id).maybeSingle();
  if (!contract || contract.owner_user_id !== ctx.userId) return { status: "error", message: M.contractForbidden };
  const { data, error } = await ctx.supabase
    .from("maintenance_tickets")
    .insert({ ...parsed.data, description: parsed.data.description ?? null, created_by: ctx.userId, status: "abierto" })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(`/panel/administracion/${parsed.data.contract_id}`);
  return { status: "ok", message: M.ticketOk, id: data.id };
}
