import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { publicCodesForSitemap } from "@/lib/catalog/data";
import { LEGAL_DOCS } from "@/lib/legal/drafts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const pages = ["", "/venta", "/renta", "/administracion", "/remodelaciones", "/cotizaciones", "/gestiones-legales", "/publica-tu-propiedad", "/nosotros", "/contacto", "/busco-propiedad", "/calculadora-hipotecaria", "/legal"];
  const listings = await publicCodesForSitemap();
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const })),
    ...Object.keys(LEGAL_DOCS).map((d) => ({ url: `${base}/legal/${d}` })),
    ...listings.map((l) => ({ url: `${base}/inmuebles/${l.code.toLowerCase()}${l.slug ? `-${l.slug}` : ""}`, lastModified: l.updated_at })),
  ];
}
