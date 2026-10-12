import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MAJ REALTY",
    short_name: "MAJ REALTY",
    description: "Venta, renta y administración de inmuebles en República Dominicana.",
    lang: "es-DO",
    start_url: "/?fuente=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#021d52",
    categories: ["business", "lifestyle"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Inmuebles en venta", url: "/venta" },
      { name: "Inmuebles en renta", url: "/renta" },
      { name: "Mi panel", url: "/panel" },
    ],
  };
}
