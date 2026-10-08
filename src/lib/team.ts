import "server-only";
import { hasSupabase } from "./env";
import { createClient } from "./supabase/server";

/** Solo asesores reales marcados por MAJ para mostrarse. Sin datos, la sección no aparece. */
export async function getTeam() {
  if (!hasSupabase) return [] as { id: string; display_name: string; title: string | null; photo_url: string | null; bio: string | null }[];
  const supabase = await createClient();
  const { data } = await supabase
    .from("advisors")
    .select("id, display_name, title, photo_path, bio")
    .eq("show_on_team_page", true)
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((a) => ({
    id: a.id as string,
    display_name: a.display_name as string,
    title: a.title as string | null,
    bio: a.bio as string | null,
    photo_url: a.photo_path ? supabase.storage.from("public-assets").getPublicUrl(a.photo_path as string).data.publicUrl : null,
  }));
}
