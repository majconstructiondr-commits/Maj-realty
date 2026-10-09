"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionContext } from "@/lib/panel/server";

export async function removeFavorite(fd: FormData) {
  const ctx = await actionContext();
  if (!ctx) return;
  const id = z.uuid().safeParse(fd.get("property_id"));
  if (!id.success) return;
  await ctx.supabase.from("favorites").delete().eq("user_id", ctx.userId).eq("property_id", id.data);
  revalidatePath("/panel/favoritos");
}
