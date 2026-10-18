import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { InstallApp } from "@/components/pwa/InstallApp";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.app.meta, alternates: { canonical: "/app" } };
}

export default async function Page() {
  const { d } = await getI18n();
  const t = d.app;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section" style={{ maxWidth: 640 }}>
        <div className="card card-body stack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-icons/icon-192.png" alt="" width={96} height={96} style={{ borderRadius: 20, boxShadow: "0 2px 10px rgba(0,0,0,.12)" }} />
          <h2 style={{ margin: 0 }}>{t.install}</h2>
          <InstallApp />
          <p className="small muted" style={{ margin: 0 }}>{t.note}</p>
        </div>
      </div>
    </>
  );
}
