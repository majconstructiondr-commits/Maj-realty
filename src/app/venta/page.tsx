import type { Metadata } from "next";
import { CatalogPage } from "@/components/property/CatalogPage";
import { parseSearch } from "@/lib/catalog/search";

export const metadata: Metadata = {
  title: "Inmuebles en venta",
  description: "Apartamentos, casas, villas, solares y locales en venta en República Dominicana.",
  alternates: { canonical: "/venta" },
};

export default async function Page(props: PageProps<"/venta">) {
  const f = parseSearch(await props.searchParams);
  return <CatalogPage operation="venta" f={f} />;
}
