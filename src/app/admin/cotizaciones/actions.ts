"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { QUOTE_SERVICES } from "@/lib/admin/labels";
import { parseForm, zBool, zCurrency, zEnumOf, zNum, zOptDate, zOptNum, zOptText, zOptUuid, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, findUserByEmail, ok, staffCtx } from "@/lib/admin/server";

const path = (id: string) => `/admin/cotizaciones/${id}`;

const stageSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600).optional(),
  duration: z.string().trim().max(60).optional(),
  percent: z.number().min(0).max(100).optional(),
});
const stagesField = z.preprocess((v) => {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}, z.array(stageSchema, { error: "Etapas no válidas" }).max(30, "Máximo 30 etapas"));

const header = {
  client_email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Correo no válido").max(160).optional()),
  client_user_id: zOptUuid,
  unlink_client: zBool,
  client_name: zText(160, 2, "Indique el nombre del cliente"),
  service: zEnumOf(QUOTE_SERVICES),
  title: zText(200, 3, "Indique un título (mínimo 3 caracteres)"),
  currency: zCurrency,
  tax_label: zOptText(40),
  tax_percent: zOptNum({ min: 0, max: 99.99, msg: "Tasa no válida" }),
  valid_until: zOptDate,
  scope: zOptText(4000),
  exclusions: zOptText(4000),
  conditions: zOptText(4000),
};

type HeaderData = z.infer<z.ZodObject<typeof header>>;
type Db = Awaited<ReturnType<typeof staffCtx>>["supabase"];

async function resolveClient(supabase: Db, d: HeaderData): Promise<{ id: string | null } | { error: string }> {
  if (d.unlink_client) return { id: null };
  if (d.client_email) {
    const r = await findUserByEmail(supabase, d.client_email);
    if (r.error !== undefined) return { error: r.error };
    return { id: r.user.id };
  }
  return { id: d.client_user_id ?? null };
}

function headerRow(d: HeaderData, clientId: string | null) {
  return {
    client_user_id: clientId,
    client_name: d.client_name,
    service: d.service,
    title: d.title,
    currency: d.currency,
    tax_label: d.tax_label ?? null,
    tax_rate: Math.round(((d.tax_percent ?? 0) / 100) * 10000) / 10000,
    valid_until: d.valid_until ?? null,
    scope: d.scope ?? null,
    exclusions: d.exclusions ?? null,
    conditions: d.conditions ?? null,
  };
}

export async function createQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ ...header, request_id: zOptUuid, stages: stagesField }), fd);
  if (!f.ok) return f.state;
  const client = await resolveClient(supabase, f.data);
  if ("error" in client) return fail(client.error);
  const { request_id, stages } = f.data;
  const { data, error } = await supabase.from("quotes")
    .insert({ ...headerRow(f.data, client.id), request_id: request_id ?? null, stages, status: "borrador" })
    .select("id").single();
  if (error || !data) return fail(error);
  redirect(path(data.id));
}

export async function updateQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ ...header, id: zUuid, stages: stagesField }), fd);
  if (!f.ok) return f.state;
  const client = await resolveClient(supabase, f.data);
  if ("error" in client) return fail(client.error);
  const { id, stages } = f.data;
  const res = await supabase.from("quotes").update({ ...headerRow(f.data, client.id), stages })
    .eq("id", id).eq("status", "borrador").select("id");
  revalidatePath(path(id));
  return confirmRows(res, "Cotización guardada.");
}

const itemSchema = {
  quote_id: zUuid,
  description: zText(500, 1, "Describa la partida"),
  quantity: zNum({ min: 0.001, max: 1e9, msg: "Cantidad no válida" }),
  unit: z.preprocess((v) => (v === "" || v === undefined ? "unidad" : v), zText(30)),
  unit_price: zNum({ min: 0, max: 1e12, msg: "Precio no válido" }),
  taxable: zBool,
  sort_order: zOptNum({ int: true, min: 0, max: 10000 }),
};

export async function addQuoteItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object(itemSchema), fd);
  if (!f.ok) return f.state;
  const { data: last } = await supabase.from("quote_items").select("sort_order").eq("quote_id", f.data.quote_id).order("sort_order", { ascending: false }).limit(1);
  const sort = f.data.sort_order ?? (((last?.[0]?.sort_order as number | undefined) ?? -1) + 1);
  const { error } = await supabase.from("quote_items").insert({ ...f.data, sort_order: sort });
  if (error) return fail(error);
  revalidatePath(path(f.data.quote_id));
  return ok("Partida agregada.");
}

export async function updateQuoteItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ ...itemSchema, id: zUuid }), fd);
  if (!f.ok) return f.state;
  const { id, quote_id, ...rest } = f.data;
  const res = await supabase.from("quote_items").update({ ...rest, sort_order: rest.sort_order ?? 0 }).eq("id", id).eq("quote_id", quote_id).select("id");
  revalidatePath(path(quote_id));
  return confirmRows(res, "Partida actualizada.");
}

export async function deleteQuoteItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ id: zUuid, quote_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("quote_items").delete().eq("id", f.data.id).eq("quote_id", f.data.quote_id).select("id");
  revalidatePath(path(f.data.quote_id));
  return confirmRows(res, "Partida eliminada.");
}

export async function setQuoteStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ id: zUuid, status: z.enum(["enviada", "anulada"], { error: "Estado no válido" }) }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("quotes").update({ status: f.data.status }).eq("id", f.data.id).select("id");
  revalidatePath(path(f.data.id));
  return confirmRows(res, f.data.status === "enviada" ? "Cotización enviada. El cliente con cuenta vinculada recibe un aviso en su panel." : "Cotización anulada.");
}

export async function duplicateQuote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/cotizaciones");
  const f = parseForm(z.object({ id: zUuid }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.rpc("duplicate_quote", { p_quote: f.data.id });
  if (error || !data) return fail(error);
  redirect(path(data as string));
}
