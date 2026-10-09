// Descarga de un documento privado: verifica la sesión y el acceso (RLS) y redirige a un enlace
// firmado de 60 segundos. El enlace nunca se guarda ni se publica.
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/panel/publicaciones/[id]/documentos/[docId]">) {
  const { id, docId } = await ctx.params;
  if (!hasSupabase || !z.uuid().safeParse(id).success || !z.uuid().safeParse(docId).success) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    const url = new URL("/cuenta/ingresar", request.url);
    url.searchParams.set("siguiente", `/panel/publicaciones/${id}/editar?paso=7`);
    return NextResponse.redirect(url, 303);
  }
  const { data: doc } = await supabase
    .from("property_documents")
    .select("storage_path, file_name")
    .eq("id", docId)
    .eq("property_id", id)
    .maybeSingle();
  if (!doc) return new NextResponse("Documento no encontrado o sin permiso", { status: 404 });
  const { data, error } = await supabase.storage.from("private-docs").createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data?.signedUrl) return new NextResponse("No se pudo generar el enlace de descarga", { status: 502 });
  const res = NextResponse.redirect(data.signedUrl, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
