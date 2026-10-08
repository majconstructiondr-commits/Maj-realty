import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { actionContext } from "@/lib/panel/server";

const SIGNED_SECONDS = 60;

/**
 * Descarga de un archivo privado (bucket private-docs). La fila se lee con la sesión del usuario,
 * de modo que RLS decide si puede verla; luego se genera una URL firmada de 60 segundos.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const kind = z.enum(["archivo", "adjunto", "comprobante", "documento"]).safeParse(sp.get("t"));
  const id = z.uuid().safeParse(sp.get("id"));
  if (!kind.success || !id.success) return text("Enlace no válido.", 400);

  const ctx = await actionContext();
  if (!ctx) {
    const url = new URL("/cuenta/ingresar", request.url);
    url.searchParams.set("siguiente", "/panel");
    return NextResponse.redirect(url, 303);
  }
  const { supabase } = ctx;
  let path: string | null = null;
  let name: string | null = null;
  if (kind.data === "archivo") {
    const { data } = await supabase.from("request_files").select("storage_path, file_name").eq("id", id.data).maybeSingle();
    path = data?.storage_path ?? null;
    name = data?.file_name ?? null;
  } else if (kind.data === "adjunto") {
    const { data } = await supabase.from("messages").select("attachment_path, attachment_name").eq("id", id.data).maybeSingle();
    path = data?.attachment_path ?? null;
    name = data?.attachment_name ?? null;
  } else if (kind.data === "comprobante") {
    const { data } = await supabase.from("management_movements").select("receipt_path, description").eq("id", id.data).maybeSingle();
    path = data?.receipt_path ?? null;
    name = path ? `comprobante-${path.split("/").pop()}` : null;
  } else {
    const { data } = await supabase.from("management_documents").select("storage_path, title").eq("id", id.data).maybeSingle();
    path = data?.storage_path ?? null;
    name = data?.title ?? null;
  }
  if (!path) return text("El archivo no existe o no tiene permiso para verlo.", 404);

  const ext = /\.[a-z0-9]{2,5}$/i.exec(path)?.[0] ?? "";
  const download = name ? (name.toLowerCase().endsWith(ext.toLowerCase()) ? name : `${name}${ext}`).replace(/[^\p{L}\p{N}._ -]+/gu, "-").slice(0, 120) : true;
  const { data, error } = await supabase.storage.from("private-docs").createSignedUrl(path, SIGNED_SECONDS, { download });
  if (error || !data?.signedUrl) return text("No se pudo generar el enlace de descarga. Intente de nuevo.", 404);
  const res = NextResponse.redirect(data.signedUrl, 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

function text(body: string, status: number) {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
