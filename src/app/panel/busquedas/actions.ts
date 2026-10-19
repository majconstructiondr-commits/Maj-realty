"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionContext, NO_SESSION } from "@/lib/panel/server";
import { parseCatalogPath } from "@/lib/panel/saved-search";
import { dbErrorMessage } from "@/lib/security";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; la acción los traduce al responder.
const M = es.panel.msg;

const schema = z.object({
  name: z.string().trim().min(1, M.searchName).max(80, M.max80),
  path: z.string().max(1000),
  notify: z.boolean(),
});

export async function createSavedSearch(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await createSavedSearchEs(_p, fd), await getLocale());
}
async function createSavedSearchEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await actionContext();
  if (!ctx) return NO_SESSION;
  const parsed = schema.safeParse({ name: fd.get("name"), path: fd.get("path") ?? "", notify: fd.get("notify") === "on" });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message, errors: { name: parsed.error.issues[0].message } };
  const query = parseCatalogPath(parsed.data.path);
  if (!query) return { status: "error", message: M.searchInvalid };
  const { count } = await ctx.supabase.from("saved_searches").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if ((count ?? 0) >= 20) return { status: "error", message: M.searchLimit };
  const { data, error } = await ctx.supabase
    .from("saved_searches")
    .insert({ user_id: ctx.userId, name: parsed.data.name, query, notify: parsed.data.notify })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/busquedas");
  return { status: "ok", message: M.searchOk, id: data.id };
}

export async function deleteSavedSearch(fd: FormData) {
  const ctx = await actionContext();
  if (!ctx) return;
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return;
  await ctx.supabase.from("saved_searches").delete().eq("id", id.data).eq("user_id", ctx.userId);
  revalidatePath("/panel/busquedas");
}
