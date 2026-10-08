"use server";
// Acciones del tablero de publicaciones: crear borrador, cambios de estado, duplicar y eliminar borrador.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { hasSupabase } from "@/lib/env";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import { newDraftSchema, zodFieldErrors } from "@/lib/listing-editor/schemas";
import { canCreateListings, getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { DUPLICATE_COLUMNS, QUICK_ACTIONS, duplicateTitle, type QuickAction } from "@/lib/listing-editor/transitions";

export async function createDraft(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: "Modo demostración: la base de datos no está configurada." };
  const ctx = await getSellerContext();
  if (!ctx) return { status: "error", message: "Su sesión expiró. Inicie sesión de nuevo." };
  if (!canCreateListings(ctx)) return { status: "error", message: "Su cuenta aún no está habilitada para publicar. Solicítelo en “Quiero publicar”." };
  const r = newDraftSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: "Revise los campos marcados.", errors: zodFieldErrors(r.error) };
  if (r.data.organization_id && !ctx.memberships.some((m) => m.organization_id === r.data.organization_id && memberCan(m, "publish"))) {
    return { status: "error", message: "No tiene permiso para publicar en esa organización.", errors: { organization_id: "Sin permiso" } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...r.data, owner_user_id: ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/publicaciones");
  redirect(`/panel/publicaciones/${data.id}/editar?paso=1`);
}

const quickSchema = z.object({
  property_id: z.uuid(),
  op: z.enum(["duplicar", "eliminar", ...(Object.keys(QUICK_ACTIONS) as QuickAction[])]),
  reason: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(300, "Máximo 300 caracteres").nullable()),
});

export async function quickAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: "Modo demostración." };
  const ctx = await getSellerContext();
  if (!ctx) return { status: "error", message: "Su sesión expiró. Inicie sesión de nuevo." };
  const r = quickSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: "Acción no válida." };
  const { property_id: id, op, reason } = r.data;
  const supabase = await createClient();
  const { data: prop } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!prop) return { status: "error", message: "Publicación no encontrada." };

  if (op === "duplicar") {
    if (!canCreateListings(ctx)) return { status: "error", message: "Su cuenta no está habilitada para publicar." };
    const copy: Record<string, unknown> = Object.fromEntries(DUPLICATE_COLUMNS.map((k) => [k, prop[k]]));
    if (copy.organization_id && !ctx.memberships.some((m) => m.organization_id === copy.organization_id && memberCan(m, "publish"))) {
      copy.organization_id = null;
    }
    const { data: created, error } = await supabase
      .from("properties")
      .insert({ ...copy, title: duplicateTitle(prop.title), owner_user_id: ctx.user.id })
      .select("id")
      .single();
    if (error || !created) return { status: "error", message: dbErrorMessage(error) };
    const { data: prices } = await supabase.from("property_prices").select("*").eq("property_id", id);
    if (prices?.length) {
      const rows = prices.map((row: Record<string, unknown>) => {
        const copyRow: Record<string, unknown> = { ...row, property_id: created.id };
        delete copyRow.id;
        return copyRow;
      });
      const ins = await supabase.from("property_prices").insert(rows).select("id");
      if (ins.error || (ins.data?.length ?? 0) !== rows.length) {
        revalidatePath("/panel/publicaciones");
        return { status: "error", message: `Se creó el borrador, pero no se copiaron los precios: ${dbErrorMessage(ins.error)}` };
      }
    }
    revalidatePath("/panel/publicaciones");
    redirect(`/panel/publicaciones/${created.id}/editar?paso=1&duplicado=1`);
  }

  if (op === "eliminar") {
    if (prop.status !== "borrador" || prop.first_published_at) return { status: "error", message: "Solo se eliminan borradores que nunca se publicaron. Puede archivarla." };
    const { data, error } = await supabase.from("properties").delete().eq("id", id).select("id");
    if (error) return { status: "error", message: dbErrorMessage(error) };
    if (!data?.length) return { status: "error", message: "No se pudo eliminar (solo el titular puede eliminar sus borradores)." };
    revalidatePath("/panel/publicaciones");
    return { status: "ok", message: "Borrador eliminado." };
  }

  const def = QUICK_ACTIONS[op as QuickAction];
  if (!(def.from as readonly string[]).includes(prop.status)) {
    return { status: "error", message: "Esa acción no está disponible en el estado actual de la publicación." };
  }
  const patch: Record<string, unknown> = { status: def.to };
  if (op === "pausar") patch.pause_reason = reason ?? "Pausada por el anunciante";
  const { data, error } = await supabase.from("properties").update(patch).eq("id", id).select("id, status");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length || data[0].status !== def.to) return { status: "error", message: "No tiene permiso para cambiar el estado de esta publicación." };
  revalidatePath("/panel/publicaciones");
  revalidatePath(`/panel/publicaciones/${id}/editar`);
  const msgs: Partial<Record<QuickAction, string>> = {
    enviar: "Enviada a revisión. MAJ la revisará antes de publicarla.",
    reenviar: "Reenviada a revisión.",
    retirar: "Retirada de revisión: volvió a borrador.",
    pausar: "Publicación pausada: ya no se muestra al público.",
    reservar: "Marcada como reservada.",
    quitar_reserva: "Reserva retirada: vuelve a mostrarse como disponible.",
    vendido: "Marcada como vendida.",
    rentado: "Marcada como rentada.",
    archivar: "Publicación archivada.",
    volver_borrador: "Volvió a borrador.",
  };
  return { status: "ok", message: msgs[op as QuickAction] ?? "Estado actualizado." };
}
