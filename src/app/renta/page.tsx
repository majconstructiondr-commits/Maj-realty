import type { Metadata } from "next";
import { CatalogPage } from "@/components/property/CatalogPage";
import { parseSearch } from "@/lib/catalog/search";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.catalog.metaRent, alternates: { canonical: "/renta" } };
}

export default async function Page(props: PageProps<"/renta">) {
  const f = parseSearch(await props.searchParams);
  return <CatalogPage operation="renta" f={f} />;
}
