import type { Metadata } from "next";
import { CatalogPage } from "@/components/property/CatalogPage";
import { parseSearch } from "@/lib/catalog/search";

export const metadata: Metadata = {
  title: "Inmuebles en renta",
  description: "Apartamentos, casas, villas, solares y locales en renta en República Dominicana.",
  alternates: { canonical: "/renta" },
};

export default async function Page(props: PageProps<"/renta">) {
  const f = parseSearch(await props.searchParams);
  return <CatalogPage operation="renta" f={f} />;
}
