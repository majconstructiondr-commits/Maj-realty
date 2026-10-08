"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zReason, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";

const path = (id: string) => `/admin/publicadores/${id}`;

/** Aprobar: otorga el rol (solo administradores escriben user_roles), activa la organización y cierra la solicitud. */
export async function approveApplication(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, isAdmin } = await staffCtx("/admin/publicadores");
  if (!isAdmin) return fail("La aprobación otorga un rol y solo la puede hacer un administrador. Deje la solicitud revisada para un administrador.");
  const f = parseForm(z.object({ id: zUuid, note: z.string().trim().max(2000).optional() }), fd);
  if (!f.ok) return f.state;
  const { data: app } = await supabase.from("publisher_applications").select("id, user_id, applicant_type, organization_id, status").eq("id", f.data.id).maybeSingle();
  if (!app) return fail("Solicitud no encontrada.");
  if (!["pendiente", "documentos_requeridos"].includes(app.status as string)) return fail("La solicitud ya fue resuelta.");
  const role = app.applicant_type as "propietario" | "vendedor" | "agencia";
  const g = await supabase.from("user_roles")
    .upsert({ user_id: app.user_id, role, granted_by: user.id }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (g.error) return fail(g.error);
  if (app.organization_id) {
    const o = await supabase.from("organizations").update({ status: "activa" }).eq("id", app.organization_id).select("id");
    if (o.error || !o.data?.length) return fail("Se otorgó el rol, pero no se pudo activar la organización. Revise en Usuarios → Agencias.");
  }
  const res = await supabase.from("publisher_applications").update({ status: "aprobada", review_reason: f.data.note || null }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  if (res.error || !res.data?.length) return fail("Se otorgó el rol, pero no se pudo cerrar la solicitud.");
  return ok("Solicitud aprobada: rol otorgado" + (app.organization_id ? " y organización activada." : ".") + " Para publicar necesita además una licencia activa.");
}

export async function requestDocuments(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/publicadores");
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("publisher_applications").update({ status: "documentos_requeridos", review_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["pendiente", "documentos_requeridos"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Se solicitaron documentos. El solicitante verá el detalle en su panel.");
}

export async function rejectApplication(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/publicadores");
  const f = parseForm(z.object({ id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("publisher_applications").update({ status: "rechazada", review_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["pendiente", "documentos_requeridos"]).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, "Solicitud rechazada con motivo.");
}
