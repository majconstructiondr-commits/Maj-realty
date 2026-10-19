import { getI18n } from "@/i18n/server";
import { SubNav } from "./Bits";

export async function ContentTabs({ current }: { current: string }) {
  const t = (await getI18n()).d.admin.common.contentTabs;
  const tabs = [
    { href: "/admin/contenido", label: t.texts },
    { href: "/admin/contenido/portafolio", label: t.portfolio },
    { href: "/admin/contenido/asesores", label: t.agents },
    { href: "/admin/contenido/legales", label: t.legal },
    { href: "/admin/contenido/tasas", label: t.rates },
  ];
  return <SubNav items={tabs} current={current} />;
}
