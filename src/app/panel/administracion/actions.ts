"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage, rateLimit } from "@/lib/security";

const schema = z.object({
  contract_id: z.uuid(),
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(160, "Máximo 160 caracteres"),
  description: z.string().trim().max(3000, "Máximo 3000 caracteres").optional(),
  priority: z.enum(["baja", "normal", "alta", "urgente"]),
});

export async function openTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  if (!rateLimit(`ticket:${ctx.userId}`, 10, 60 * 60 * 1000)) return { status: "error", message: "Demasiados reportes en poco tiempo. Intente más tarde." };
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
  if (!contract || contract.owner_user_id !== ctx.userId) return { status: "error", message: "No tiene permiso para este contrato." };
  const { data, error } = await ctx.supabase
    .from("maintenance_tickets")
    .insert({ ...parsed.data, description: parsed.data.description ?? null, created_by: ctx.userId, status: "abierto" })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(`/panel/administracion/${parsed.data.contract_id}`);
  return { status: "ok", message: "Solicitud de mantenimiento registrada. El equipo de MAJ la revisará.", id: data.id };
}
