import { publicFeedListings } from "@/lib/catalog/data";
import { buildMetaFeed } from "@/lib/catalog/feed";
import { env } from "@/lib/env";

// Se arma en cada consulta (con caché corta en la CDN), así refleja al momento lo aprobado, cambiado o retirado.
export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await publicFeedListings(env.siteUrl);
  const xml = buildMetaFeed(listings, { title: "MAJ REALTY", selfUrl: `${env.siteUrl}/feeds/facebook.xml` });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
