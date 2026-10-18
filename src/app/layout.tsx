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
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import { getI18n } from "@/i18n/server";
import { I18nProvider, type ClientDictionary } from "@/i18n/client";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: d.meta.title, template: "%s · MAJ REALTY" },
    description: d.meta.description,
    openGraph: { type: "website", locale: d.meta.ogLocale, siteName: "MAJ REALTY SRL" },
    alternates: { canonical: "/" },
    applicationName: "MAJ REALTY",
    appleWebApp: { capable: true, title: "MAJ REALTY", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#021d52", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, { locale, d }] = await Promise.all([getSiteSettings(), getSessionUser(), getI18n()]);
  // Al cliente solo llega el diccionario del idioma activo, y solo las partes que usan sus componentes.
  const clientDict: ClientDictionary = {
    nav: d.nav, common: d.common, header: d.header, search: d.search, map: d.map, gallery: d.gallery, share: d.share,
    report: d.report, form: d.form, labels: d.labels, mortgage: d.mortgage, app: d.app, errorPage: d.errorPage,
  };
  return (
    <html lang={d.meta.htmlLang} className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <I18nProvider locale={locale} d={clientDict}>
          <a href="#contenido" className="skip-link">{d.header.skipToContent}</a>
          {!hasSupabase ? (
            <div className="demo-banner" role="status">
              {d.header.demoBanner}
            </div>
          ) : null}
          <Header logo={<BrandLogo alt={d.header.logoAlt} />} signedIn={Boolean(user)} />
          <main id="contenido">{children}</main>
          <Footer s={settings} d={d} />
          <WhatsAppLink
            floating
            number={settings["whatsapp.primary"]}
            // La plantilla de WhatsApp se mantiene en español: el mensaje lo recibe el equipo de MAJ.
            text={fillTemplate(settings["whatsapp.template"], { servicio: "sus servicios" })}
            label={d.whatsapp.floatingLabel}
            opensHint={d.whatsapp.opensHint}
          />
          <RegisterServiceWorker />
        </I18nProvider>
      </body>
    </html>
  );
}
