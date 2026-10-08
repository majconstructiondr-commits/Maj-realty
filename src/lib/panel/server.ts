import "server-only";
import { hasSupabase } from "../env";
import { createClient } from "../supabase/server";

/** Cliente con la sesión del usuario y su id verificado. null si no hay sesión (o no hay base de datos). */
export async function actionContext() {
  if (!hasSupabase) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { supabase, userId: data.user.id };
}

export const NO_SESSION = { status: "error" as const, message: "Su sesión venció. Inicie sesión de nuevo." };
