"use server";
// Acciones del editor de publicaciones. Cada acción verifica la sesión, usa el cliente con la sesión
// del usuario (RLS) y solo informa éxito cuando la base de datos confirmó el cambio.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import {
  basicSchema, buildChangeSet, isLiveStatus, locationSchema, operationsFor, parseDistribution, parseFeatures, parsePrices,
  privateSchema, zodFieldErrors, asksTitleInfo, TITLE_INFO_FIELDS, DOC_TYPES_LABELS, type ChangeSet, type PriceRow,
} from "@/lib/listing-editor/schemas";
import type { EditorPrice, EditorProperty } from "@/lib/listing-editor/types";
import { localizeResult, localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.editor.msg;

type Supa = Awaited<ReturnType<typeof createClient>>;
export type SimpleResult = { ok: true; message: string } | { ok: false; message: string };

const editorPath = (id: string) => `/panel/publicaciones/${id}/editar`;
const PRICE_COLS = [
  "operation", "amount", "currency", "negotiable", "maintenance_amount", "maintenance_currency", "maintenance_included",
  "additional_costs", "rent_period", "deposit_amount", "deposit_months", "advance_months", "min_term_months", "delivery_conditions",
] as const;

/** Sesión + publicación visible + permiso de edición (comprobado en la base de datos). */
async function authorize(propertyId: unknown) {
  if (!hasSupabase) return { error: M.demoDb } as const;
  const id = z.uuid().safeParse(propertyId);
  if (!id.success) return { error: M.listingInvalid } as const;
  const user = await getSessionUser();
  if (!user) return { error: M.sessionExpired } as const;
  const supabase = await createClient();
  const { data: property } = await supabase.from("properties").select("*").eq("id", id.data).maybeSingle();
  if (!property) return { error: M.listingNotFound } as const;
  const { data: canEdit } = await supabase.rpc("property_access", { p_property: id.data, p_level: "edit" });
  if (canEdit !== true) return { error: M.noEditPermission } as const;
  return { supabase, user, property: property as EditorProperty, id: id.data } as const;
}

const toPriceRow = (p: EditorPrice): PriceRow =>
  Object.fromEntries(PRICE_COLS.map((k) => [k, (p as Record<string, unknown>)[k] ?? null])) as unknown as PriceRow;

async function updateProperty(supabase: Supa, id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from("properties").update(patch).eq("id", id).select("id");
  if (error) return dbErrorMessage(error);
  if (!data?.length) return M.notSaved;
  return null;
}

async function updatePrivate(supabase: Supa, id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase.from("property_private").update(patch).eq("property_id", id).select("property_id");
  if (error) return dbErrorMessage(error);
  if (!data?.length) return M.privateNotSaved;
  return null;
}

async function replacePrices(supabase: Supa, id: string, rows: PriceRow[], operation: "venta" | "renta" | "ambas") {
  const keep = operationsFor(operation);
  const del = await supabase.from("property_prices").delete().eq("property_id", id).not("operation", "in", `(${keep.join(",")})`);
  if (del.error) return dbErrorMessage(del.error);
  if (!rows.length) return null;
  const { data, error } = await supabase
    .from("property_prices")
    .upsert(rows.map((r) => ({ ...r, property_id: id })), { onConflict: "property_id,operation" })
    .select("id");
  if (error) return dbErrorMessage(error);
  if ((data?.length ?? 0) !== rows.length) return M.pricesNotSaved;
  return null;
}

/** Envía (o actualiza) la solicitud de cambio de una publicación activa combinándola con la pendiente. */
async function requestChange(
  supabase: Supa,
  property: EditorProperty,
  update: {
    property?: Record<string, unknown>;
    private?: Record<string, unknown>;
    prices?: PriceRow[];
  },
): Promise<ActionState> {
  const id = property.id;
  const [{ data: pendingRow }, priv, prices] = await Promise.all([
    supabase.from("property_change_requests").select("changes").eq("property_id", id).eq("status", "pendiente").maybeSingle(),
    update.private ? supabase.from("property_private").select("*").eq("property_id", id).maybeSingle() : Promise.resolve({ data: null }),
    update.prices ? supabase.from("property_prices").select("*").eq("property_id", id) : Promise.resolve({ data: null }),
  ]);
  const pending = (pendingRow?.changes ?? null) as ChangeSet | null;
  const set = buildChangeSet(pending, {
    property: update.property ? { current: property as unknown as Record<string, unknown>, next: update.property } : undefined,
    private: update.private ? { current: (priv.data ?? {}) as Record<string, unknown>, next: update.private } : undefined,
    prices: update.prices ? { current: ((prices.data ?? []) as EditorPrice[]).map((p) => toPriceRow(p) as unknown as Record<string, unknown>), next: update.prices } : undefined,
  });
  if (!set) {
    return pending
      ? { status: "ok", message: M.sameAsPublishedPending }
      : { status: "ok", message: M.sameAsPublished };
  }
  const { data, error } = await supabase.rpc("submit_property_change", { p_property: id, p_changes: set });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data) return { status: "error", message: M.changeFailed };
  return {
    status: "ok",
    id: String(data),
    message: M.changeSent,
  };
}

/** Guarda un paso del editor (borrador) o lo convierte en solicitud de cambio (publicación activa). */
export async function saveStep(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await saveStepEs(_prev, fd), await getLocale());
}
async function saveStepEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize(fd.get("property_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const { supabase, property, id } = auth;
  const step = Number(fd.get("step"));
  const goNext = fd.get("_continuar") === "1";
  const raw = formToObject(fd);
  const live = isLiveStatus(property.status);
  let result: ActionState;

  const invalid = (errors: Record<string, string>): ActionState => ({
    status: "error",
    message: M.reviewFields,
    errors,
  });

  switch (step) {
    case 1: {
      const r = basicSchema.safeParse(raw);
      if (!r.success) return invalid(zodFieldErrors(r.error));
      const { available_from, ...rest } = r.data;
      if (!live) {
        const err = (await updateProperty(supabase, id, { ...rest, available_from }))
          ?? (rest.operation !== property.operation ? await replacePrices(supabase, id, [], rest.operation) : null);
        result = err ? { status: "error", message: err } : { status: "ok", message: M.draftSaved };
        break;
      }
      // La fecha de disponibilidad se actualiza directamente; el resto requiere revisión.
      if ((available_from ?? null) !== (property.available_from ?? null)) {
        const err = await updateProperty(supabase, id, { available_from });
        if (err) return { status: "error", message: err };
      }
      let prices: PriceRow[] | undefined;
      if (rest.operation !== property.operation) {
        const { data: cur } = await supabase.from("property_prices").select("*").eq("property_id", id);
        const { data: pend } = await supabase.from("property_change_requests").select("changes").eq("property_id", id).eq("status", "pendiente").maybeSingle();
        const base = ((pend?.changes as ChangeSet | undefined)?.prices ?? ((cur ?? []) as EditorPrice[]).map(toPriceRow)) as PriceRow[];
        prices = base.filter((p) => operationsFor(rest.operation).includes(p.operation));
      }
      result = await requestChange(supabase, property, { property: rest, prices });
      break;
    }
    case 2: {
      const r = locationSchema.safeParse(raw);
      if (!r.success) return invalid(zodFieldErrors(r.error));
      if (!live) {
        const err = (await updateProperty(supabase, id, r.data.property)) ?? (await updatePrivate(supabase, id, r.data.private));
        result = err ? { status: "error", message: err } : { status: "ok", message: M.draftSaved };
      } else {
        result = await requestChange(supabase, property, { property: r.data.property, private: r.data.private });
      }
      break;
    }
    case 3: {
      const operation = (live ? (await pendingOperation(supabase, id)) : null) ?? property.operation;
      const r = parsePrices(raw, operation);
      if (!r.ok) return invalid(r.errors);
      if (!live) {
        const err = await replacePrices(supabase, id, r.rows, operation);
        result = err ? { status: "error", message: err } : { status: "ok", message: M.pricesSaved };
      } else {
        result = await requestChange(supabase, property, { prices: r.rows });
      }
      break;
    }
    case 4: {
      const r = parseDistribution(raw);
      if (!r.ok) return invalid(r.errors);
      if (!live) {
        const err = await updateProperty(supabase, id, r.data);
        result = err ? { status: "error", message: err } : { status: "ok", message: M.draftSaved };
      } else {
        result = await requestChange(supabase, property, { property: r.data });
      }
      break;
    }
    case 5: {
      const r = parseFeatures(raw);
      if (!r.ok) return invalid(r.errors);
      if (!live) {
        const err = await updateProperty(supabase, id, r.data);
        result = err ? { status: "error", message: err } : { status: "ok", message: M.draftSaved };
      } else {
        result = await requestChange(supabase, property, { property: r.data });
      }
      break;
    }
    case 7: {
      const r = privateSchema.safeParse(raw);
      if (!r.success) return invalid(zodFieldErrors(r.error));
      // Sin esos campos en el formulario, no se tocan los datos del título que ya hubiera.
      if (!asksTitleInfo(property.property_type)) for (const k of TITLE_INFO_FIELDS) delete (r.data as Record<string, unknown>)[k];
      if (!live) {
        const err = await updatePrivate(supabase, id, r.data);
        result = err ? { status: "error", message: err } : { status: "ok", message: M.privateSaved };
      } else {
        result = await requestChange(supabase, property, { private: r.data });
      }
      break;
    }
    default:
      return { status: "error", message: M.stepInvalid };
  }

  if (result.status === "ok") {
    revalidatePath(editorPath(id));
    revalidatePath("/panel/publicaciones");
    if (goNext) redirect(`${editorPath(id)}?paso=${step + 1}`);
  }
  return result;
}

/** Operación propuesta en la solicitud pendiente (si cambia la operación de una publicación activa). */
async function pendingOperation(supabase: Supa, id: string) {
  const { data } = await supabase.from("property_change_requests").select("changes").eq("property_id", id).eq("status", "pendiente").maybeSingle();
  const op = (data?.changes as ChangeSet | undefined)?.property?.operation;
  return op === "venta" || op === "renta" || op === "ambas" ? op : null;
}

// ---------------------------------------------------------------------
// Envío a revisión
// ---------------------------------------------------------------------
export async function submitForReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await submitForReviewEs(_prev, fd), await getLocale());
}
async function submitForReviewEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await authorize(fd.get("property_id"));
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const { supabase, property, id } = auth;
  if (!["borrador", "rechazado", "pausado"].includes(property.status)) {
    return { status: "error", message: M.cannotSubmit };
  }
  if (fd.get("confirm") !== "on") {
    return { status: "error", message: M.confirmTruth, errors: { confirm: M.mustConfirm } };
  }
  const { data, error } = await supabase.from("properties").update({ status: "en_revision" }).eq("id", id).select("id, code, status");
  if (error) return { status: "error", message: dbErrorMessage(error) };
  if (!data?.length || data[0].status !== "en_revision") return { status: "error", message: M.submitFailed };
  revalidatePath("/panel/publicaciones");
  revalidatePath(editorPath(id));
  redirect(`/panel/publicaciones?enviado=${encodeURIComponent(data[0].code)}`);
}

// ---------------------------------------------------------------------
// Multimedia
// ---------------------------------------------------------------------
const fileNameRe = /^[A-Za-z0-9._-]{1,200}$/;

async function objectExists(supabase: Supa, bucket: string, path: string) {
  const idx = path.lastIndexOf("/");
  const folder = path.slice(0, idx);
  const name = path.slice(idx + 1);
  const { data, error } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 5 });
  if (error) return null;
  return (data ?? []).find((o) => o.name === name) ?? null;
}

const photoSchema = z.object({
  propertyId: z.uuid(),
  kind: z.enum(["foto", "plano"]),
  storagePath: z.string().max(300),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  altText: z.string().trim().min(3, M.altMin).max(200, M.max200),
});

export async function addPhoto(input: z.input<typeof photoSchema>): Promise<SimpleResult> {
  return localizeResult(await addPhotoEs(input), await getLocale());
}
async function addPhotoEs(input: z.input<typeof photoSchema>): Promise<SimpleResult> {
  const r = photoSchema.safeParse(input);
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const prefix = `properties/${id}/`;
  const name = r.data.storagePath.slice(prefix.length);
  if (!r.data.storagePath.startsWith(prefix) || !fileNameRe.test(name) || !/\.(webp|jpe?g|png)$/i.test(name)) {
    return { ok: false, message: M.imagePathInvalid };
  }
  if (!(await objectExists(supabase, "property-media", r.data.storagePath))) {
    return { ok: false, message: M.imageNotFound };
  }
  const { data: last } = await supabase.from("property_media").select("sort_order").eq("property_id", id).order("sort_order", { ascending: false }).limit(1);
  const { count: covers } = await supabase.from("property_media").select("id", { count: "exact", head: true }).eq("property_id", id).eq("is_cover", true);
  const { data, error } = await supabase
    .from("property_media")
    .insert({
      property_id: id,
      kind: r.data.kind,
      storage_path: r.data.storagePath,
      alt_text: r.data.altText,
      width: r.data.width,
      height: r.data.height,
      sort_order: (last?.[0]?.sort_order ?? -1) + 1,
      is_cover: r.data.kind === "foto" && !covers,
    })
    .select("id");
  if (error || !data?.length) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(editorPath(id));
  return { ok: true, message: M.imageAdded };
}

const externalSchema = z.object({
  property_id: z.uuid(),
  kind: z.enum(["video", "recorrido"], { error: M.linkKind }),
  external_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, M.httpsLink),
  alt_text: z.string().trim().min(3, M.linkAltMin).max(200),
});

export async function addExternalMedia(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await addExternalMediaEs(_prev, fd), await getLocale());
}
async function addExternalMediaEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = externalSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.reviewFields, errors: zodFieldErrors(r.error) };
  const auth = await authorize(r.data.property_id);
  if ("error" in auth) return { status: "error", message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const { data: last } = await supabase.from("property_media").select("sort_order").eq("property_id", id).order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("property_media")
    .insert({ property_id: id, kind: r.data.kind, external_url: r.data.external_url, alt_text: r.data.alt_text, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
    .select("id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath(editorPath(id));
  return { status: "ok", message: M.linkAdded };
}

const mediaRef = z.object({ propertyId: z.uuid(), mediaId: z.uuid() });

export async function moveMedia(input: { propertyId: string; mediaId: string; direction: "up" | "down" }): Promise<SimpleResult> {
  return localizeResult(await moveMediaEs(input), await getLocale());
}
async function moveMediaEs(input: { propertyId: string; mediaId: string; direction: "up" | "down" }): Promise<SimpleResult> {
  const r = mediaRef.safeParse(input);
  if (!r.success || (input.direction !== "up" && input.direction !== "down")) return { ok: false, message: M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const { data: rows } = await supabase.from("property_media").select("id, sort_order").eq("property_id", id).order("sort_order").order("created_at");
  const list = (rows ?? []) as { id: string; sort_order: number }[];
  const i = list.findIndex((m) => m.id === r.data.mediaId);
  const j = input.direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false, message: M.cannotMove };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].sort_order === k) continue;
    const { data, error } = await supabase.from("property_media").update({ sort_order: k }).eq("id", list[k].id).select("id");
    if (error || !data?.length) return { ok: false, message: dbErrorMessage(error) };
  }
  revalidatePath(editorPath(id));
  return { ok: true, message: M.orderUpdated };
}

export async function setCover(input: { propertyId: string; mediaId: string }): Promise<SimpleResult> {
  return localizeResult(await setCoverEs(input), await getLocale());
}
async function setCoverEs(input: { propertyId: string; mediaId: string }): Promise<SimpleResult> {
  const r = mediaRef.safeParse(input);
  if (!r.success) return { ok: false, message: M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const { data: m } = await supabase.from("property_media").select("id, kind").eq("id", r.data.mediaId).eq("property_id", id).maybeSingle();
  if (!m || m.kind !== "foto") return { ok: false, message: M.coverPhotoOnly };
  const off = await supabase.from("property_media").update({ is_cover: false }).eq("property_id", id).eq("is_cover", true);
  if (off.error) return { ok: false, message: dbErrorMessage(off.error) };
  const { data, error } = await supabase.from("property_media").update({ is_cover: true }).eq("id", m.id).select("id");
  if (error || !data?.length) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(editorPath(id));
  return { ok: true, message: M.coverUpdated };
}

export async function deleteMedia(input: { propertyId: string; mediaId: string }): Promise<SimpleResult> {
  return localizeResult(await deleteMediaEs(input), await getLocale());
}
async function deleteMediaEs(input: { propertyId: string; mediaId: string }): Promise<SimpleResult> {
  const r = mediaRef.safeParse(input);
  if (!r.success) return { ok: false, message: M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const { data, error } = await supabase.from("property_media").delete().eq("id", r.data.mediaId).eq("property_id", id).select("storage_path");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: M.itemNotFound };
  const path = data[0].storage_path as string | null;
  if (path) await supabase.storage.from("property-media").remove([path]);
  revalidatePath(editorPath(id));
  return { ok: true, message: M.deleted };
}

/** Elimina un archivo recién cargado cuyo registro no se pudo crear (limpieza). */
export async function discardUpload(input: { propertyId: string; storagePath: string }): Promise<void> {
  const auth = await authorize(input.propertyId);
  if ("error" in auth) return;
  const prefix = `properties/${auth.id}/`;
  if (typeof input.storagePath !== "string" || !input.storagePath.startsWith(prefix)) return;
  if (!fileNameRe.test(input.storagePath.slice(prefix.length))) return;
  const { count } = await auth.supabase.from("property_media").select("id", { count: "exact", head: true }).eq("storage_path", input.storagePath);
  if (!count) await auth.supabase.storage.from("property-media").remove([input.storagePath]);
}

// ---------------------------------------------------------------------
// Documentos privados (permitidos también en publicaciones activas: quedan "pendiente")
// ---------------------------------------------------------------------
const docSchema = z.object({
  propertyId: z.uuid(),
  docType: z.enum(Object.keys(DOC_TYPES_LABELS) as [keyof typeof DOC_TYPES_LABELS, ...(keyof typeof DOC_TYPES_LABELS)[]], { error: M.docType }),
  storagePath: z.string().max(300),
  fileName: z.string().trim().min(1).max(200),
});
const DOC_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function addDocument(input: z.input<typeof docSchema>): Promise<SimpleResult> {
  return localizeResult(await addDocumentEs(input), await getLocale());
}
async function addDocumentEs(input: z.input<typeof docSchema>): Promise<SimpleResult> {
  const r = docSchema.safeParse(input);
  if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { supabase, id } = auth;
  const prefix = `properties/${id}/`;
  if (!r.data.storagePath.startsWith(prefix) || !fileNameRe.test(r.data.storagePath.slice(prefix.length))) {
    return { ok: false, message: M.pathInvalid };
  }
  const obj = await objectExists(supabase, "private-docs", r.data.storagePath);
  if (!obj) return { ok: false, message: M.fileNotFound };
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const size = Number(meta.size ?? 0);
  const mime = String(meta.mimetype ?? "");
  if (!DOC_MIME.includes(mime) || !(size > 0 && size <= 15 * 1024 * 1024)) {
    return { ok: false, message: M.fileFormat };
  }
  const { data, error } = await supabase
    .from("property_documents")
    .insert({ property_id: id, doc_type: r.data.docType, storage_path: r.data.storagePath, file_name: r.data.fileName, mime_type: mime, size_bytes: size })
    .select("id");
  if (error || !data?.length) return { ok: false, message: dbErrorMessage(error) };
  revalidatePath(editorPath(id));
  return { ok: true, message: M.docUploaded };
}

export async function deleteDocument(input: { propertyId: string; documentId: string }): Promise<SimpleResult> {
  return localizeResult(await deleteDocumentEs(input), await getLocale());
}
async function deleteDocumentEs(input: { propertyId: string; documentId: string }): Promise<SimpleResult> {
  const r = z.object({ propertyId: z.uuid(), documentId: z.uuid() }).safeParse(input);
  if (!r.success) return { ok: false, message: M.dataInvalid };
  const auth = await authorize(r.data.propertyId);
  if ("error" in auth) return { ok: false, message: auth.error ?? M.notAuthorized };
  const { data, error } = await auth.supabase.from("property_documents").delete().eq("id", r.data.documentId).eq("property_id", auth.id).select("id");
  if (error) return { ok: false, message: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: M.docWithdrawOnly };
  revalidatePath(editorPath(auth.id));
  return { ok: true, message: M.docWithdrawn };
}

