import "server-only";
import { hasSupabase } from "../env";
import { createClient } from "../supabase/server";
import { es } from "@/i18n/es";

/** Cliente con la sesión del usuario y su id verificado. null si no hay sesión (o no hay base de datos). */
export async function actionContext() {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

/** En español; las acciones lo traducen con localizeState al responder. */
export const NO_SESSION = { status: "error" as const, message: es.panel.msg.noSession };
