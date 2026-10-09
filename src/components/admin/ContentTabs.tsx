import { SubNav } from "./Bits";

const TABS = [
  { href: "/admin/contenido", label: "Textos" },
  { href: "/admin/contenido/portafolio", label: "Portafolio" },
  { href: "/admin/contenido/asesores", label: "Asesores" },
  { href: "/admin/contenido/legales", label: "Servicios legales" },
  { href: "/admin/contenido/tasas", label: "Tasas de cambio" },
];

export function ContentTabs({ current }: { current: string }) {
  return <SubNav items={TABS} current={current} />;
}
