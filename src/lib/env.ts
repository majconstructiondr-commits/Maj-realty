// Variables de entorno públicas y privadas. Ningún secreto se expone al navegador:
// solo las variables NEXT_PUBLIC_* llegan al cliente.

export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // Logo oficial recibido de MAJ (public/brand/). Puede sustituirse con NEXT_PUBLIC_LOGO_SRC.
  logoSrc: process.env.NEXT_PUBLIC_LOGO_SRC || "/brand/maj-realty-logo.webp",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
};

/** true cuando hay base de datos configurada. Sin ella el sitio funciona en modo demostración. */
export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseKey);

/** Solo servidor */
export function serverEnv() {
  return {
    cronSecret: process.env.CRON_SECRET ?? "",
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",
    ipHashSalt: process.env.IP_HASH_SALT ?? "",
  };
}
