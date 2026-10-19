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
import { isStaffRole } from "@/lib/auth";
import { newDraftSchema, zodFieldErrors } from "@/lib/listing-editor/schemas";
import { canCreateListings, getSellerContext, memberCan, type SellerContext } from "@/lib/listing-editor/server";
import { DUPLICATE_COLUMNS, QUICK_ACTIONS, duplicateTitle, type QuickAction } from "@/lib/listing-editor/transitions";
import { fmt, localizeMessage, localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getI18n, getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.editor.msg;

// Lo que publica el personal de MAJ a su nombre es publicación de MAJ: no consume licencia.
// La base solo acepta la marca con sesión de dos pasos (is_staff exige aal2).
const isMajListing = (ctx: SellerContext, orgId: unknown) =>
  !orgId && isStaffRole(ctx.user) && ctx.user.aal === "aal2";

export async function createDraft(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createDraftEs(_prev, fd), await getLocale());
}
async function createDraftEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: M.demoDb };
  const ctx = await getSellerContext();
  if (!ctx) return { status: "error", message: M.sessionExpired };
  if (!canCreateListings(ctx)) return { status: "error", message: M.notEnabled };
  const r = newDraftSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.reviewFields, errors: zodFieldErrors(r.error) };
  if (r.data.organization_id && !ctx.memberships.some((m) => m.organization_id === r.data.organization_id && memberCan(m, "publish"))) {
    return { status: "error", message: M.orgForbidden, errors: { organization_id: M.noPermission } };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...r.data, owner_user_id: ctx.user.id, is_maj_listing: isMajListing(ctx, r.data.organization_id) })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/publicaciones");
  redirect(`/panel/publicaciones/${data.id}/editar?paso=1`);
}

const quickSchema = z.object({
  property_id: z.uuid(),
  op: z.enum(["duplicar", "eliminar", ...(Object.keys(QUICK_ACTIONS) as QuickAction[])]),
  reason: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(300, M.max300).nullable()),
});

export async function quickAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await quickActionEs(_prev, fd), await getLocale());
}
async function quickActionEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: M.demo };
  const ctx = await getSellerContext();
  if (!ctx) return { status: "error", message: M.sessionExpired };
  const r = quickSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.actionInvalid };
  const { property_id: id, op, reason } = r.data;
  const supabase = await createClient();
  const { data: prop } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!prop) return { status: "error", message: M.listingNotFound };

  if (op === "duplicar") {
    const { d, locale } = await getI18n();
    if (!canCreateListings(ctx)) return { status: "error", message: M.notEnabledShort };
    const copy: Record<string, unknown> = Object.fromEntries(DUPLICATE_COLUMNS.map((k) => [k, prop[k]]));
    if (copy.organization_id && !ctx.memberships.some((m) => m.organization_id === copy.organization_id && memberCan(m, "publish"))) {
      copy.organization_id = null;
    }
    const { data: created, error } = await supabase
      .from("properties")
      .insert({ ...copy, title: duplicateTitle(prop.title), owner_user_id: ctx.user.id, is_maj_listing: isMajListing(ctx, copy.organization_id) })
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
        return { status: "error", message: fmt(d.editor.msg.pricesNotCopied, { error: localizeMessage(dbErrorMessage(ins.error), locale) }) };
      }
    }
    revalidatePath("/panel/publicaciones");
    redirect(`/panel/publicaciones/${created.id}/editar?paso=1&duplicado=1`);
  }

  if (op === "eliminar") {
    if (prop.status !== "borrador" || prop.first_published_at) return { status: "error", message: M.deleteDraftsOnly };
    const { data, error } = await supabase.from("properties").delete().eq("id", id).select("id");
    if (error) return { status: "error", message: dbErrorMessage(error) };
    if (!data?.length) return { status: "error", message: M.deleteFailed };
    revalidatePath("/panel/publicaciones");
    return { status: "ok", message: M.draftDeleted };
  }

  const def = QUICK_ACTIONS[op as QuickAction];
  if (!(def.from as readonly string[]).includes(prop.status)) {
    return { status: "error", message: M.actionUnavailable };
  }
  const patch: Record<string, unknown> = { status: def.to };
  if (op === "pausar") patch.pause_reason = reason ?? "Pausada por el anunciante";
  const { data, error } = await supabase.from("properties").update(patch).eq("id", id).select("id, status");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length || data[0].status !== def.to) return { status: "error", message: M.statusForbidden };
  revalidatePath("/panel/publicaciones");
  revalidatePath(`/panel/publicaciones/${id}/editar`);
  const msgs: Partial<Record<QuickAction, string>> = {
    enviar: M.sentToReview,
    reenviar: M.resent,
    retirar: M.withdrawn,
    pausar: M.paused,
    reservar: M.reserved,
    quitar_reserva: M.unreserved,
    vendido: M.sold,
    rentado: M.rented,
    archivar: M.archived,
    volver_borrador: M.backToDraft,
  };
  return { status: "ok", message: msgs[op as QuickAction] ?? M.statusUpdated };
}
