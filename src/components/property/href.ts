import type { CatalogListing } from "@/lib/catalog/types";

/** Enlace a la ficha (archivo aparte para usarlo en el cliente sin cargar ListingCard). */
export function listingHref(l: Pick<CatalogListing, "code" | "slug">, back?: string) {
  const path = `/inmuebles/${l.code.toLowerCase()}${l.slug ? `-${l.slug}` : ""}`;
  return back ? `${path}?volver=${encodeURIComponent(back)}` : path;
}
