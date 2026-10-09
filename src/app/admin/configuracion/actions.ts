"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm } from "@/lib/admin/form";
import { parseSettingValue } from "@/lib/admin/settings";
import { adminCtx, confirmRows, fail } from "@/lib/admin/server";

export async function saveSetting(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await adminCtx("/admin/configuracion");
  const f = parseForm(z.object({
    key: z.string().regex(/^[a-z0-9_.-]{2,80}$/),
    kind: z.enum(["boolean", "number", "text", "json"]),
    value: z.string().max(20000).optional(),
    bool: z.string().optional(),
  }), fd);
  if (!f.ok) return f.state;
  const parsed = parseSettingValue(f.data.kind, f.data.kind === "boolean" ? f.data.bool ?? "" : f.data.value ?? "");
  if (!parsed.ok) return fail(parsed.error);
  const res = await supabase.from("site_settings")
    .update({ value: parsed.value, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq("key", f.data.key).select("key");
  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
  return confirmRows(res, "Configuración guardada.");
}
