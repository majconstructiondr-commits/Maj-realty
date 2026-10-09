import "server-only";
import { hasSupabase } from "./env";
import { createClient } from "./supabase/server";

/** Textos editables desde el panel (content_blocks), sin tocar código. */
export async function getContentBlock(key: string, locale = "es") {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("content_blocks").select("title, body").eq("key", key).eq("locale", locale).maybeSingle();
  return data as { title: string | null; body: string } | null;
}
