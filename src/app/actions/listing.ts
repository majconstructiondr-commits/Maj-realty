"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkHuman, clientIpHash, dbErrorMessage, rateLimit } from "@/lib/security";
import { localizeMessage } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function toggleFavorite(propertyId: string, path: string) {
  const { locale, d } = await getI18n();
  if (!hasSupabase) return { ok: false, message: d.actions.favoriteDemo };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) redirect(`/cuenta/ingresar?siguiente=${encodeURIComponent(path)}`);
  const { data: existing } = await supabase.from("favorites").select("property_id").eq("property_id", propertyId).maybeSingle();
  const res = existing
    ? await supabase.from("favorites").delete().eq("property_id", propertyId).eq("user_id", u.user.id)
    : await supabase.from("favorites").insert({ user_id: u.user.id, property_id: propertyId });
  if (res.error) return { ok: false, message: localizeMessage(dbErrorMessage(res.error), locale) };
  revalidatePath(path);
  return { ok: true, favorite: !existing };
}

const reportSchema = z.object({
  property_id: z.uuid(),
  reason: z.enum(["informacion_falsa", "no_disponible", "precio_incorrecto", "fraude", "contenido_inapropiado", "duplicado", "otro"]),
  details: z.string().trim().max(2000).optional(),
  contact_email: z.preprocess((v) => (v === "" ? undefined : v), z.email().max(160).optional()),
});

export type ReportState = { status: "idle" | "ok" | "error"; message?: string };

export async function reportListing(_p: ReportState, fd: FormData): Promise<ReportState> {
  const { locale, d } = await getI18n();
  const a = d.actions;
  if (!hasSupabase) return { status: "error", message: a.reportDemo };
  if (!(await checkHuman(fd))) return { status: "error", message: a.reportHuman };
  if (!rateLimit(`rep:${await clientIpHash()}`, 5, 60 * 60 * 1000)) return { status: "error", message: a.reportTooMany };
  const parsed = reportSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "error", message: a.reportReason };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("property_reports").insert({ ...parsed.data, reporter_id: u.user?.id ?? null });
  if (error) return { status: "error", message: localizeMessage(dbErrorMessage(error), locale) };
  return { status: "ok", message: a.reportOk };
}
