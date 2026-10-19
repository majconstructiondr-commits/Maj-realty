import { publicPhotoUrl } from "@/lib/catalog/data";

// Enlace fijo a una foto pública: redirige a una URL firmada nueva (las firmadas vencen en una hora).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/feeds/foto/[id]">) {
  const { id } = await ctx.params;
  const url = /^[0-9a-f-]{36}$/i.test(id) ? await publicPhotoUrl(id) : null;
  if (!url) return new Response("No encontrada", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "public, s-maxage=1800" } });
}
