"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkHuman, clientIpHash, dbErrorMessage, rateLimit } from "@/lib/security";

export async function toggleFavorite(propertyId: string, path: string) {
  if (!hasSupabase) return { ok: false, message: "Disponible cuando la base de datos esté configurada." };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) redirect(`/cuenta/ingresar?siguiente=${encodeURIComponent(path)}`);
  const { data: existing } = await supabase.from("favorites").select("property_id").eq("property_id", propertyId).maybeSingle();
  const res = existing
    ? await supabase.from("favorites").delete().eq("property_id", propertyId).eq("user_id", u.user.id)
    : await supabase.from("favorites").insert({ user_id: u.user.id, property_id: propertyId });
  if (res.error) return { ok: false, message: dbErrorMessage(res.error) };
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
  if (!hasSupabase) return { status: "error", message: "Modo demostración: el reporte no se guardó." };
  if (!(await checkHuman(fd))) return { status: "error", message: "No pudimos verificar el envío. Intente de nuevo." };
  if (!rateLimit(`rep:${await clientIpHash()}`, 5, 60 * 60 * 1000)) return { status: "error", message: "Demasiados reportes. Intente más tarde." };
  const parsed = reportSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "error", message: "Seleccione un motivo válido." };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("property_reports").insert({ ...parsed.data, reporter_id: u.user?.id ?? null });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  return { status: "ok", message: "Gracias. El equipo de MAJ revisará la publicación." };
}
