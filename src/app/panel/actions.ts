"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext } from "@/lib/panel/server";

/** Marca una notificación propia como leída (RLS y permisos de columna lo limitan a read_at). */
export async function markNotificationRead(fd: FormData) {
  const ctx = await actionContext();
  if (!ctx) return;
  const id = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!id.success) return;
  await ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", ctx.userId).is("read_at", null);
  revalidatePath("/panel");
}

export async function markAllNotificationsRead() {
  const ctx = await actionContext();
  if (!ctx) return;
  await ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.userId).is("read_at", null);
  revalidatePath("/panel");
}
