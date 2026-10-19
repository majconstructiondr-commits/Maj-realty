"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { label } from "@/lib/panel/labels";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage } from "@/lib/security";
import { fmt, localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getI18n, getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; la acción los traduce al responder.
const M = es.panel.msg;

const schema = z.object({
  quote_id: z.uuid(),
  decision: z.enum(["aceptar", "rechazar"], { error: M.decision }),
  comment: z.string().trim().max(2000, M.max2000).optional(),
});

export async function respondQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await respondQuoteEs(_p, fd), await getLocale());
}
async function respondQuoteEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = schema.safeParse({ quote_id: fd.get("quote_id"), decision: fd.get("decision"), comment: fd.get("comment") ?? undefined });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  if (parsed.data.decision === "aceptar" && fd.get("confirm") !== "on") {
    return { status: "error", message: M.confirmRead, errors: { confirm: M.confirm } };
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
    return { status: "error", message: M.quoteExpired };
  }
  const { d } = await getI18n();
  return { status: "ok", message: fmt(d.panel.msg.quoteAnswered, { status: label(d.status.clientQuote, status).toLowerCase() }) };
}
