import type { Metadata } from "next";
import Link from "next/link";
import { legalDocs } from "@/lib/legal/drafts";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.legal.meta, alternates: { canonical: "/legal" } };
}

export default async function Page() {
  const { locale, d } = await getI18n();
  return (
    <div className="container section" style={{ maxWidth: 860 }}>
      {d.legal.note ? <p className="alert alert-info small">{d.legal.note}</p> : null}
      <h1>{d.legal.title}</h1>
      <p className="alert alert-warning">{d.legal.draftsWarning}</p>
      <div className="grid-2" style={{ marginTop: 16 }}>
        {Object.entries(legalDocs(locale)).map(([k, doc]) => (
          <Link key={k} href={`/legal/${k}`} className="card card-body" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{doc.title}</h3>
            <p className="small muted" style={{ margin: 0 }}>{doc.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
