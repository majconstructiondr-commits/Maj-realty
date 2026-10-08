"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zOptText, zUuid } from "@/lib/admin/form";
import { confirmRows, staffCtx } from "@/lib/admin/server";

export async function updatePropertyReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/reportes");
  const f = parseForm(z.object({
    id: zUuid, status: z.enum(["en_revision", "resuelto", "descartado"], { error: "Estado no válido" }), resolution: zOptText(2000),
  }).refine((d) => d.status === "en_revision" || Boolean(d.resolution && d.resolution.length >= 3), { message: "Indique la resolución", path: ["resolution"] }), fd);
  if (!f.ok) return f.state;
  const closing = f.data.status !== "en_revision";
  const res = await supabase.from("property_reports")
    .update({ status: f.data.status, resolution: f.data.resolution ?? null, resolved_by: closing ? user.id : null })
    .eq("id", f.data.id).in("status", ["abierto", "en_revision"]).select("id");
  revalidatePath("/admin/reportes");
  return confirmRows(res, closing ? "Reporte cerrado con resolución." : "Reporte marcado en revisión.");
}
