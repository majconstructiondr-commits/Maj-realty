"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zOptText, zUuid } from "@/lib/admin/form";
import { confirmRows, staffCtx } from "@/lib/admin/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

export async function updatePropertyReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updatePropertyReportEs(_p, fd), await getLocale());
}
async function updatePropertyReportEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/reportes");
  const f = parseForm(z.object({
    id: zUuid, status: z.enum(["en_revision", "resuelto", "descartado"], { error: M.invalidStatus }), resolution: zOptText(2000),
  }).refine((d) => d.status === "en_revision" || Boolean(d.resolution && d.resolution.length >= 3), { message: M.resolutionRequired, path: ["resolution"] }), fd);
  if (!f.ok) return f.state;
  const closing = f.data.status !== "en_revision";
  const res = await supabase.from("property_reports")
    .update({ status: f.data.status, resolution: f.data.resolution ?? null, resolved_by: closing ? user.id : null })
    .eq("id", f.data.id).in("status", ["abierto", "en_revision"]).select("id");
  revalidatePath("/admin/reportes");
  return confirmRows(res, closing ? M.reportClosed : M.reportInReview);
}
