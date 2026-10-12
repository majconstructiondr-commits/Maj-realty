import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { InstallApp } from "@/components/pwa/InstallApp";

export const metadata: Metadata = {
  title: "Descarga la app",
  description: "Instale la app de MAJ REALTY en su teléfono para ver inmuebles y su panel con un toque.",
  alternates: { canonical: "/app" },
};

export default function Page() {
  return (
    <>
      <PageHero eyebrow="App" title="La app de MAJ REALTY" lead="Tenga los inmuebles, sus solicitudes y sus pagos de renta en la pantalla de su teléfono." />
      <div className="container section" style={{ maxWidth: 640 }}>
        <div className="card card-body stack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-icons/icon-192.png" alt="" width={96} height={96} style={{ borderRadius: 20, boxShadow: "0 2px 10px rgba(0,0,0,.12)" }} />
          <h2 style={{ margin: 0 }}>Instálela gratis</h2>
          <InstallApp />
          <p className="small muted" style={{ margin: 0 }}>No ocupa espacio como una app normal y siempre está actualizada.</p>
        </div>
      </div>
    </>
  );
}
