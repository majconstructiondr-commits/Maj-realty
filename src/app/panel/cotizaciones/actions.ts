"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { label, QUOTE_STATUSES } from "@/lib/panel/labels";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage } from "@/lib/security";

const schema = z.object({
  quote_id: z.uuid(),
  decision: z.enum(["aceptar", "rechazar"], { error: "Elija aceptar o rechazar" }),
  comment: z.string().trim().max(2000, "Máximo 2000 caracteres").optional(),
});

export async function respondQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = schema.safeParse({ quote_id: fd.get("quote_id"), decision: fd.get("decision"), comment: fd.get("comment") ?? undefined });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  if (parsed.data.decision === "aceptar" && fd.get("confirm") !== "on") {
    return { status: "error", message: "Marque la casilla para confirmar que leyó las condiciones.", errors: { confirm: "Confirme" } };
  }
  const { data, error } = await ctx.supabase.rpc("respond_quote", {
    p_quote: parsed.data.quote_id,
    p_accept: parsed.data.decision === "aceptar",
    p_comment: parsed.data.comment || null,
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(`/panel/cotizaciones/${parsed.data.quote_id}`);
  revalidatePath("/panel/cotizaciones");
  const status = String(data);
  if (status === "vencida") {
    return {
      status: "error",
      message: "La vigencia de esta cotización ya pasó y quedó como vencida. Escríbanos para solicitar una cotización actualizada.",
    };
  }
  return { status: "ok", message: `Respuesta registrada: cotización ${label(QUOTE_STATUSES, status).toLowerCase()}.` };
}
