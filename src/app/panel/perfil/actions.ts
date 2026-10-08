"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { dbErrorMessage } from "@/lib/security";

const phone = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().regex(/^[0-9+()\s-]{7,25}$/, "Teléfono no válido (solo números, espacios, +, guiones)").nullable(),
);

const schema = z.object({
  full_name: z.string().trim().min(2, "Indique su nombre").max(160, "Máximo 160 caracteres"),
  display_name: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(80, "Máximo 80 caracteres").nullable()),
  phone,
  whatsapp: phone,
  marketing_opt_in: z.boolean(),
});

export async function updateProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = schema.safeParse({
    full_name: fd.get("full_name") ?? "",
    display_name: fd.get("display_name"),
    phone: fd.get("phone"),
    whatsapp: fd.get("whatsapp"),
    marketing_opt_in: fd.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { status: "error", message: "Revise los campos marcados.", errors };
  }
  const d = parsed.data;
  const { data: current } = await ctx.supabase.from("profile_private").select("marketing_opt_in").eq("user_id", ctx.userId).maybeSingle();

  const p1 = await ctx.supabase.from("profiles").update({ full_name: d.full_name, display_name: d.display_name }).eq("id", ctx.userId).select("id").single();
  if (p1.error || !p1.data) return { status: "error", message: dbErrorMessage(p1.error) };
  const privUpdate: Record<string, unknown> = { phone: d.phone, whatsapp: d.whatsapp, marketing_opt_in: d.marketing_opt_in };
  if (d.marketing_opt_in !== Boolean(current?.marketing_opt_in)) privUpdate.marketing_opt_in_at = d.marketing_opt_in ? new Date().toISOString() : null;
  const p2 = await ctx.supabase.from("profile_private").update(privUpdate).eq("user_id", ctx.userId).select("user_id").single();
  if (p2.error || !p2.data) return { status: "error", message: dbErrorMessage(p2.error) };
  revalidatePath("/panel", "layout");
  return { status: "ok", message: "Perfil actualizado." };
}
