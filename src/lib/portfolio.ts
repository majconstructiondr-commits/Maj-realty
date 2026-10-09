import "server-only";
import { hasSupabase } from "./env";
import { createClient } from "./supabase/server";

/** Portafolio real de remodelaciones, solo con autorización de uso de imágenes (lo exige la base de datos). */
export async function getPortfolio() {
  if (!hasSupabase) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_items")
    .select("id, title, description, location_summary, before_path, after_path")
    .eq("published", true)
    .order("sort_order");
  const url = (p: string | null) => (p ? supabase.storage.from("public-assets").getPublicUrl(p).data.publicUrl : null);
  return (data ?? []).map((i) => ({ ...i, before_url: url(i.before_path), after_url: url(i.after_path) }));
}

export async function getEnabledLegalServices() {
  if (!hasSupabase) return [] as { code: string; name: string; description: string | null }[];
  const supabase = await createClient();
  const { data } = await supabase.from("legal_services").select("code, name, description").eq("enabled", true).order("sort_order");
  return data ?? [];
}
