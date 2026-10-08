import "server-only";
import type { createClient } from "./supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Copia al perfil la aceptación de términos registrada en los metadatos del alta
 * (versión vigente cuando el usuario se registró). Solo se escribe una vez.
 */
export async function recordTermsAcceptance(supabase: Client) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const version = typeof meta.terms_version === "string" ? meta.terms_version.slice(0, 60) : null;
  if (!version) return;
  const acceptedAt = typeof meta.terms_accepted_at === "string" && !Number.isNaN(Date.parse(meta.terms_accepted_at))
    ? meta.terms_accepted_at
    : new Date().toISOString();
  const { data: profile } = await supabase.from("profiles").select("terms_version_accepted").eq("id", user.id).maybeSingle();
  if (!profile || profile.terms_version_accepted) return;
  await supabase.from("profiles").update({ terms_version_accepted: version, terms_accepted_at: acceptedAt }).eq("id", user.id);
}
