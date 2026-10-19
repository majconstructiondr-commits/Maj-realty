"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zCurrency, zNum, zOptNum, zOptText, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows } from "@/lib/admin/server";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.admin.msg;

export async function savePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await savePlanEs(_p, fd), await getLocale());
}
async function savePlanEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx("/admin/planes");
  const f = parseForm(z.object({
    id: zUuid,
    name: zText(80, 2, M.nameRequired),
    description: zOptText(1000),
    price: zOptNum({ min: 0, max: 1e10, msg: M.invalidPrice }),
    currency: zCurrency,
    duration_days: zNum({ int: true, min: 1, max: 3660 }),
    active_listing_quota: zNum({ int: true, min: 0, max: 100000 }),
    max_members: zNum({ int: true, min: 1, max: 10000 }),
    sort_order: zNum({ int: true, min: 0, max: 1000 }),
    is_active: zBool,
  }), fd);
  if (!f.ok) return f.state;
  const { id, ...row } = f.data;
  const res = await supabase.from("plans").update({ ...row, price: row.price ?? null, description: row.description ?? null }).eq("id", id).select("id");
  revalidatePath("/admin/planes");
  return confirmRows(res, row.price === undefined ? M.planSavedTbd : M.planSaved);
}
