"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zCurrency, zDate, zNum, zOptText, zOptUuid, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows, fail, findUserByEmail, ok, safeStoragePath, staffCtx } from "@/lib/admin/server";

const BASE = "/admin/contenido";

// ---------------- Bloques de contenido ----------------
export async function saveContentBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx(BASE);
  const f = parseForm(z.object({
    key: z.string().trim().regex(/^[a-z0-9_.-]{2,80}$/, "Clave no válida: minúsculas, números, punto, guion o guion bajo"),
    locale: z.enum(["es", "en"]),
    title: zOptText(200),
    body: z.string().max(20000, "Texto demasiado largo"),
  }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("content_blocks")
    .upsert({ ...f.data, title: f.data.title ?? null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "key,locale" });
  if (error) return fail(error);
  revalidatePath(BASE);
  revalidatePath("/", "layout");
  return ok("Texto guardado.");
}

export async function deleteContentBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ key: zText(80), locale: z.enum(["es", "en"]) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("content_blocks").delete().eq("key", f.data.key).eq("locale", f.data.locale).select("key");
  revalidatePath(BASE);
  return confirmRows(res, "Texto eliminado: el sitio usará su texto por defecto.");
}

// ---------------- Portafolio ----------------
const portfolioFields = {
  title: zText(160, 3, "Indique el título"),
  description: zOptText(2000),
  location_summary: zOptText(160),
  image_use_authorized: zBool,
  authorization_reference: zOptText(300),
  sort_order: zNum({ int: true, min: 0, max: 10000 }),
};

export async function createPortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object(portfolioFields), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("portfolio_items").insert({ ...f.data, published: false });
  if (error) return fail(error);
  revalidatePath(`${BASE}/portafolio`);
  return ok("Trabajo creado como no publicado. Cargue las imágenes y publíquelo cuando tenga autorización.");
}

export async function updatePortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ ...portfolioFields, id: zUuid, published: zBool })
    .refine((d) => !d.published || d.image_use_authorized, { message: "Para publicar se requiere la autorización de uso de imágenes", path: ["published"] })
    .refine((d) => !d.image_use_authorized || Boolean(d.authorization_reference), { message: "Indique la referencia de la autorización (documento, fecha o persona)", path: ["authorization_reference"] }), fd);
  if (!f.ok) return f.state;
  const { id, ...row } = f.data;
  if (row.published) {
    const { data: cur } = await supabase.from("portfolio_items").select("after_path").eq("id", id).maybeSingle();
    if (!cur?.after_path) return fail("Para publicar, cargue primero la imagen de “después”.");
  }
  const res = await supabase.from("portfolio_items")
    .update({ ...row, description: row.description ?? null, location_summary: row.location_summary ?? null, authorization_reference: row.authorization_reference ?? null })
    .eq("id", id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  revalidatePath("/remodelaciones");
  return confirmRows(res, row.published ? "Trabajo guardado y publicado." : "Trabajo guardado (no publicado).");
}

export async function setPortfolioImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ id: zUuid, slot: z.enum(["before_path", "after_path"]), storage_path: zText(400) }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `portfolio/${f.data.id}/`)) return fail("Ruta de imagen no válida.");
  const res = await supabase.from("portfolio_items").update({ [f.data.slot]: f.data.storage_path }).eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  return confirmRows(res, "Imagen cargada.");
}

export async function deletePortfolioItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(BASE);
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("portfolio_items").delete().eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/portafolio`);
  return confirmRows(res, "Trabajo eliminado del portafolio.");
}

// ---------------- Asesores (solo administradores) ----------------
const advisorFields = {
  display_name: zText(80, 2, "Indique el nombre"),
  title: zOptText(80),
  whatsapp: z.preprocess((v) => (typeof v === "string" ? v.replace(/\D/g, "") || undefined : v), z.string().regex(/^[0-9]{10,15}$/, "WhatsApp: solo dígitos con código de país (10 a 15)").optional()),
  bio: zOptText(600),
  user_email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Correo no válido").optional()),
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
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object(advisorFields), fd);
  if (!f.ok) return f.state;
  const r = await advisorRow(supabase, f.data);
  if ("error" in r) return fail(r.error ?? "Error");
  if (r.row.show_on_team_page) return fail("Cree el asesor sin mostrar en la página de equipo; active esa opción después de cargar una foto real autorizada.");
  const { error } = await supabase.from("advisors").insert(r.row);
  if (error) return fail(error);
  revalidatePath(`${BASE}/asesores`);
  return ok("Asesor creado.");
}

export async function updateAdvisor(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object({ ...advisorFields, id: zUuid, unlink_user: zBool }), fd);
  if (!f.ok) return f.state;
  const { id, unlink_user, ...d } = f.data;
  const r = await advisorRow(supabase, d);
  if ("error" in r) return fail(r.error ?? "Error");
  const row: Record<string, unknown> = { ...r.row };
  if (unlink_user) row.user_id = null;
  if (row.show_on_team_page) {
    const { data: cur } = await supabase.from("advisors").select("photo_path").eq("id", id).maybeSingle();
    if (!cur?.photo_path) return fail("Para mostrarlo en la página de equipo, cargue primero una foto real autorizada.");
  }
  const res = await supabase.from("advisors").update(row).eq("id", id).select("id");
  revalidatePath(`${BASE}/asesores`);
  revalidatePath("/nosotros");
  return confirmRows(res, "Asesor guardado.");
}

export async function setAdvisorPhoto(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/asesores`);
  const f = parseForm(z.object({ id: zUuid, storage_path: zText(400) }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `team/${f.data.id}/`)) return fail("Ruta de imagen no válida.");
  const res = await supabase.from("advisors").update({ photo_path: f.data.storage_path }).eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/asesores`);
  return confirmRows(res, "Foto cargada.");
}

// ---------------- Servicios legales (solo administradores) ----------------
export async function saveLegalService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx(`${BASE}/legales`);
  const f = parseForm(z.object({
    code: z.string().regex(/^[a-z0-9_]{2,40}$/), name: zText(120, 2), description: zOptText(1000),
    enabled: zBool, responsible_professional: zOptText(160), sort_order: zNum({ int: true, min: 0, max: 1000 }),
  }).refine((d) => !d.enabled || Boolean(d.responsible_professional && d.responsible_professional.length >= 3), {
    message: "Para habilitar el servicio indique el profesional responsable", path: ["responsible_professional"],
  }), fd);
  if (!f.ok) return f.state;
  const { code, ...row } = f.data;
  const res = await supabase.from("legal_services")
    .update({ ...row, description: row.description ?? null, responsible_professional: row.responsible_professional ?? null })
    .eq("code", code).select("code");
  revalidatePath(`${BASE}/legales`);
  revalidatePath("/gestiones-legales");
  return confirmRows(res, row.enabled ? "Servicio habilitado con profesional responsable." : "Servicio guardado (deshabilitado).");
}

// ---------------- Tasas de cambio ----------------
export async function addExchangeRate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx(`${BASE}/tasas`);
  const f = parseForm(z.object({
    base: zCurrency, quote: zCurrency, rate: zNum({ min: 0.000001, max: 1e6, msg: "Tasa no válida" }),
    source: zText(200, 2, "Indique la fuente (p. ej. Banco Central RD)"), rate_date: zDate,
  }).refine((d) => d.base !== d.quote, { message: "Las monedas deben ser distintas", path: ["quote"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("exchange_rates").insert({ ...f.data, entered_by: user.id });
  if (error) return fail(error);
  revalidatePath(`${BASE}/tasas`);
  return ok("Tasa registrada con su fuente y fecha.");
}

export async function deleteExchangeRate(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx(`${BASE}/tasas`);
  const f = parseForm(z.object({ id: zOptUuid }), fd);
  if (!f.ok || !f.data.id) return fail("Registro no válido.");
  const res = await supabase.from("exchange_rates").delete().eq("id", f.data.id).select("id");
  revalidatePath(`${BASE}/tasas`);
  return confirmRows(res, "Registro eliminado.");
}
