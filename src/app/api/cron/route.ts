import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NO_STORE } from "@/lib/admin/api";
import { serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/admin";

// Tareas programadas (vencimiento de licencias, avisos y cotizaciones vencidas).
// Llamar con: Authorization: Bearer ${CRON_SECRET}
export const dynamic = "force-dynamic";

function sameSecret(given: string, expected: string) {
  // Se comparan resúmenes de igual longitud para que el tiempo no dependa del contenido.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const secret = serverEnv().cronSecret;
  if (!secret || secret.length < 16) {
    return Response.json({ error: "CRON_SECRET no configurado" }, { status: 503, headers: NO_STORE });
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!sameSecret(token, secret)) {
    return Response.json({ error: "No autorizado" }, { status: 401, headers: NO_STORE });
  }
  let client;
  try {
    client = createServiceClient();
  } catch {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY no configurada" }, { status: 503, headers: NO_STORE });
  }
  const { data, error } = await client.rpc("run_scheduled_jobs");
  if (error) {
    console.error("cron: run_scheduled_jobs falló", error.message);
    return Response.json({ error: "La tarea falló" }, { status: 500, headers: NO_STORE });
  }
  return Response.json({ ok: true, result: data, at: new Date().toISOString() }, { headers: NO_STORE });
}
