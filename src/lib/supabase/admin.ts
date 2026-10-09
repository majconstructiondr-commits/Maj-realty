import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Cliente con la llave de servicio (omite RLS). USO EXCLUSIVO de la tarea programada /api/cron,
 * porque run_scheduled_jobs solo está concedida a service_role. Nunca usar en páginas ni acciones.
 * La llave se lee de SUPABASE_SERVICE_ROLE_KEY (variable solo de servidor, jamás NEXT_PUBLIC_*).
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key || !env.supabaseUrl) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada");
  }
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
