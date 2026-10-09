import type { NextRequest } from "next/server";
import { apiStaff, NO_STORE } from "@/lib/admin/api";
import { createClient } from "@/lib/supabase/server";

// Descarga de archivos privados para el personal: genera un enlace firmado de 60 segundos al hacer clic.
// La base de datos vuelve a validar el acceso (políticas de storage.objects con la sesión del usuario).
const BUCKETS = ["private-docs", "property-media"] as const;

export async function GET(req: NextRequest) {
  const auth = await apiStaff();
  if ("error" in auth) return auth.error;
  const bucket = req.nextUrl.searchParams.get("bucket") ?? "private-docs";
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!(BUCKETS as readonly string[]).includes(bucket) || !path || path.length > 400 || path.includes("..") || path.startsWith("/")) {
    return new Response("Solicitud no válida", { status: 400, headers: NO_STORE });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60, bucket === "private-docs" ? { download: true } : undefined);
  if (error || !data?.signedUrl) return new Response("Archivo no disponible", { status: 404, headers: NO_STORE });
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: data.signedUrl, "Referrer-Policy": "no-referrer" } });
}
