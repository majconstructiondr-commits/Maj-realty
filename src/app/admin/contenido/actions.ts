"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zCurrency, zDate, zNum, zOptText, zOptUuid, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows, fail, findUserByEmail, ok, safeStoragePath, staffCtx } from "@/lib/admin/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

const BASE = "/admin/contenido";

// ---------------- Bloques de contenido ----------------
export async function saveContentBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await saveContentBlockEs(_p, fd), await getLocale());
}
async function saveContentBlockEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx(BASE);
  const f = parseForm(z.object({
    key: z.string().trim().regex(/^[a-z0-9_.-]{2,80}$/, M.invalidKey),
    locale: z.enum(["es", "en"]),
    title: zOptText(200),
    body: z.string().max(20000, M.textTooLong),
  }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("content_blocks")
    .upsert({ ...f.data, title: f.data.title ?? null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key,locale" });
  if (error) return fail(error);
  revalidatePath(BASE);
  revalidatePath("/", "layout");
  return ok(M.textSaved);
}

export async function deleteContentBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await deleteContentBlockEs(_p, fd), await getLocale());
}
async function deleteContentBlockEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ key: zText(80), locale: z.enum(["es", "en"]) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("content_blocks").delete().eq("key", f.data.key).eq("locale", f.data.locale).select("key");
  revalidatePath(BASE);
  return confirmRows(res, M.textDeleted);
}

// ---------------- Portafolio ----------------
const portfolioFields = {
  title: zText(160, 3, M.titleRequired),
  description: zOptText(2000),
  location_summary: zOptText(160),
  image_use_authorized: zBool,
  authorization_reference: zOptText(300),
  sort_order: zNum({ int: true, min: 0, max: 10000 }),
};

export async function createPortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createPortfolioItemEs(_p, fd), await getLocale());
}
async function createPortfolioItemEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object(portfolioFields), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("portfolio_items").insert({ ...f.data, published: false });
  if (error) return fail(error);
  revalidatePath(`${BASE}/portafolio`);
  return ok(M.workCreated);
}

export async function updatePortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updatePortfolioItemEs(_p, fd), await getLocale());
}
async function updatePortfolioItemEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ ...portfolioFields, id: zUuid, published: zBool })
    .refine((d) => !d.published || d.image_use_authorized, { message: M.publishNeedsAuth, path: ["published"] })
    .refine((d) => !d.image_use_authorized || Boolean(d.authorization_reference), { message: M.authRefRequired, path: ["authorization_reference"] }), fd);
  if (!f.ok) return f.state;
  const { id, ...row } = f.data;
  if (row.published) {
    const { data: cur } = await supabase.from("portfolio_items").select("after_path").eq("id", id).maybeSingle();
    if (!cur?.after_path) return fail(M.afterImageFirst);
  }
  const res = await supabase.from("portfolio_items")
    .update({ ...row, description: row.description ?? null, location_summary: row.location_summary ?? null, authorization_reference: row.authorization_reference ?? null })
    .eq("id", id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  revalidatePath("/remodelaciones");
  return confirmRows(res, row.published ? M.workPublished : M.workSaved);
}

export async function setPortfolioImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setPortfolioImageEs(_p, fd), await getLocale());
}
async function setPortfolioImageEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ id: zUuid, slot: z.enum(["before_path", "after_path"]), storage_path: zText(400) }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `portfolio/${f.data.id}/`)) return fail(M.invalidImagePath);
  const res = await supabase.from("portfolio_items").update({ [f.data.slot]: f.data.storage_path }).eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  return confirmRows(res, M.imageUploaded);
}

export async function deletePortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await deletePortfolioItemEs(_p, fd), await getLocale());
}
async function deletePortfolioItemEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("portfolio_items").delete().eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  return confirmRows(res, M.workDeleted);
}

// ---------------- Asesores (solo administradores) ----------------
const advisorFields = {
  display_name: zText(80, 2, M.nameRequired),
  title: zOptText(80),
  whatsapp: z.preprocess((v) => (typeof v === "string" ? v.replace(/\D/g, "") || undefined : v), z.string().regex(/^[0-9]{10,15}$/, M.whatsappDigits).optional()),
  bio: zOptText(600),
  user_email: z.preprocess((v) => (v === "" ? undefined : v), z.email(M.invalidEmail).optional()),
  is_active: zBool,
  show_on_team_page: zBool,
  sort_order: zNum({ int: true, min: 0, max: 10000 }),
};

async function advisorRow(supabase: Awaited<ReturnType<typeof adminCtx>>["supabase"], d: z.infer<z.ZodObject<typeof advisorFields>>) {
  let user_id: string | null | undefined = undefined;
  if (d.user_email) {
    const r = await findUserByEmail(supabase, d.user_email);
    if (r.error !== undefined) return { error: r.error };
    user_id = r.user.id;
  }
  const { user_email: _u, ...rest } = d;
  void _u;
  return { row: { ...rest, title: rest.title ?? null, whatsapp: rest.whatsapp ?? null, bio: rest.bio ?? null, ...(user_id !== undefined ? { user_id } : {}) } };
}

export async function createAdvisor(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createAdvisorEs(_p, fd), await getLocale());
}
async function createAdvisorEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object(advisorFields), fd);
  if (!f.ok) return f.state;
  const r = await advisorRow(supabase, f.data);
  if ("error" in r) return fail(r.error ?? M.error);
  if (r.row.show_on_team_page) return fail(M.teamPageLater);
  const { error } = await supabase.from("advisors").insert(r.row);
  if (error) return fail(error);
  revalidatePath(`${BASE}/asesores`);
  return ok(M.advisorCreated);
}

export async function updateAdvisor(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await updateAdvisorEs(_p, fd), await getLocale());
}
async function updateAdvisorEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object({ ...advisorFields, id: zUuid, unlink_user: zBool }), fd);
  if (!f.ok) return f.state;
  const { id, unlink_user, ...d } = f.data;
  const r = await advisorRow(supabase, d);
  if ("error" in r) return fail(r.error ?? M.error);
  const row: Record<string, unknown> = { ...r.row };
  if (unlink_user) row.user_id = null;
  if (row.show_on_team_page) {
    const { data: cur } = await supabase.from("advisors").select("photo_path").eq("id", id).maybeSingle();
    if (!cur?.photo_path) return fail(M.teamPhotoFirst);
  }
  const res = await supabase.from("advisors").update(row).eq("id", id).select("id");
  revalidatePath(`${BASE}/asesores`);
  revalidatePath("/nosotros");
  return confirmRows(res, M.advisorSaved);
}

export async function setAdvisorPhoto(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await setAdvisorPhotoEs(_p, fd), await getLocale());
}
async function setAdvisorPhotoEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object({ id: zUuid, storage_path: zText(400) }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `team/${f.data.id}/`)) return fail(M.invalidImagePath);
  const res = await supabase.from("advisors").update({ photo_path: f.data.storage_path }).eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/asesores`);
  return confirmRows(res, M.photoUploaded);
}

// ---------------- Servicios legales (solo administradores) ----------------
export async function saveLegalService(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await saveLegalServiceEs(_p, fd), await getLocale());
}
async function saveLegalServiceEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/legales`);
  const f = parseForm(z.object({
    code: z.string().regex(/^[a-z0-9_]{2,40}$/), name: zText(120, 2), description: zOptText(1000),
    enabled: zBool, responsible_professional: zOptText(160), sort_order: zNum({ int: true, min: 0, max: 1000 }),
  }).refine((d) => !d.enabled || Boolean(d.responsible_professional && d.responsible_professional.length >= 3), {
    message: M.responsibleRequired, path: ["responsible_professional"],
  }), fd);
  if (!f.ok) return f.state;
  const { code, ...row } = f.data;
  const res = await supabase.from("legal_services")
    .update({ ...row, description: row.description ?? null, responsible_professional: row.responsible_professional ?? null })
    .eq("code", code).select("code");
  revalidatePath(`${BASE}/legales`);
  revalidatePath("/gestiones-legales");
  return confirmRows(res, row.enabled ? M.serviceEnabled : M.serviceSaved);
}

// ---------------- Tasas de cambio ----------------
export async function addExchangeRate(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await addExchangeRateEs(_p, fd), await getLocale());
}
async function addExchangeRateEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx(`${BASE}/tasas`);
  const f = parseForm(z.object({
    base: zCurrency, quote: zCurrency, rate: zNum({ min: 0.000001, max: 1e6, msg: M.invalidRate }),
    source: zText(200, 2, M.sourceRequired), rate_date: zDate,
  }).refine((d) => d.base !== d.quote, { message: M.currenciesDiffer, path: ["quote"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("exchange_rates").insert({ ...f.data, entered_by: user.id });
  if (error) return fail(error);
  revalidatePath(`${BASE}/tasas`);
  return ok(M.rateAdded);
}

export async function deleteExchangeRate(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await deleteExchangeRateEs(_p, fd), await getLocale());
}
async function deleteExchangeRateEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(`${BASE}/tasas`);
  const f = parseForm(z.object({ id: zOptUuid }), fd);
  if (!f.ok || !f.data.id) return fail(M.invalidRecord);
  const res = await supabase.from("exchange_rates").delete().eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/tasas`);
  return confirmRows(res, M.recordDeleted);
}
