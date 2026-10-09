import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { env, hasSupabase } from "@/lib/env";
import { getSiteSettings } from "@/lib/site";
import { getSessionUser } from "@/lib/auth";
import { fillTemplate } from "@/lib/whatsapp";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: "MAJ REALTY SRL · Bienes raíces en República Dominicana", template: "%s · MAJ REALTY" },
  description:
    "Venta, renta y administración de inmuebles, remodelaciones, cotizaciones y gestiones de propiedades en República Dominicana.",
  openGraph: { type: "website", locale: "es_DO", siteName: "MAJ REALTY SRL" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#0b1f3a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSiteSettings(), getSessionUser()]);
  return (
    <html lang="es-DO" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {!hasSupabase ? (
          <div className="demo-banner" role="status">
            Modo demostración: la base de datos no está configurada. Los inmuebles mostrados son de ejemplo y los formularios no guardan datos.
          </div>
        ) : null}
        <Header logo={<BrandLogo />} signedIn={Boolean(user)} />
        <main id="contenido">{children}</main>
        <Footer s={settings} />
        <WhatsAppLink
          floating
          number={settings["whatsapp.primary"]}
          text={fillTemplate(settings["whatsapp.template"], { servicio: "sus servicios" })}
          label="WhatsApp"
        />
      </body>
    </html>
  );
}
