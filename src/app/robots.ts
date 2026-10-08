import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const production = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production";
  if (!production || process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true") {
    // Hasta el lanzamiento (dominio confirmado, sin datos de demostración) no se indexa.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/panel", "/admin", "/cuenta", "/auth", "/api"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
