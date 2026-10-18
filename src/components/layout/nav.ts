import type { Dictionary } from "@/i18n/es";

// Menú principal: el texto de cada enlace sale del diccionario del idioma activo.
export const mainNav: { href: string; key: keyof Dictionary["nav"] }[] = [
  { href: "/", key: "home" },
  { href: "/venta", key: "sale" },
  { href: "/renta", key: "rent" },
  { href: "/administracion", key: "management" },
  { href: "/remodelaciones", key: "remodeling" },
  { href: "/cotizaciones", key: "quotes" },
  { href: "/gestiones-legales", key: "legal" },
  { href: "/publica-tu-propiedad", key: "publish" },
  { href: "/nosotros", key: "about" },
  { href: "/contacto", key: "contact" },
];
