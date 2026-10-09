"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zBool, zCurrency, zNum, zOptNum, zOptText, zText, zUuid } from "@/lib/admin/form";
import { adminCtx, confirmRows } from "@/lib/admin/server";

export async function savePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await adminCtx("/admin/planes");
  const f = parseForm(z.object({
    id: zUuid,
    name: zText(80, 2, "Indique el nombre"),
    description: zOptText(1000),
    price: zOptNum({ min: 0, max: 1e10, msg: "Precio no válido" }),
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
  return confirmRows(res, row.price === undefined ? "Plan guardado (precio por definir)." : "Plan guardado. Las licencias existentes conservan sus cuotas hasta renovarse.");
}
