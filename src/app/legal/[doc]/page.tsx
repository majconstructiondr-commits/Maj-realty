import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, legalDocs } from "@/lib/legal/drafts";
import { getContentBlock } from "@/lib/content";
import { getSiteSettings } from "@/lib/site";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata(props: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const [{ doc }, { locale, d: t }] = await Promise.all([props.params, getI18n()]);
  const d = legalDocs(locale)[doc];
  return d ? { title: d.title, alternates: { canonical: `/legal/${doc}` } } : { title: t.legal.notFound };
}

export default async function Page(props: PageProps<"/legal/[doc]">) {
  const { doc } = await props.params;
  const [override, s, { locale, d: t }] = await Promise.all([getContentBlock(`legal.${doc}`), getSiteSettings(), getI18n()]);
  const d = legalDocs(locale)[doc];
  if (!d) notFound();
  // El texto que reemplaza al borrador desde el panel es contenido de la base de datos (en español).
  const fromDb = Boolean(override?.body);
  return (
    <div className="container section" style={{ maxWidth: 860 }}>
      {fromDb ? (
        t.legal.spanishOnly ? <p className="alert alert-info small">{t.legal.spanishOnly}</p> : null
      ) : t.legal.note ? (
        <p className="alert alert-info small">{t.legal.note}</p>
      ) : null}
      <nav className="small"><Link href="/legal">{t.legal.back}</Link></nav>
      <h1 lang={override?.title ? "es-DO" : undefined}>{override?.title ?? d.title}</h1>
      <p className="alert alert-warning small">{fmt(t.legal.draftNote, { v: s["legal.documents_version"] })}</p>
      {override?.body ? (
        <div style={{ whiteSpace: "pre-line" }} lang="es-DO">{override.body}</div>
      ) : (
        d.sections.map((sec) => (
          <section key={sec.h} style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: "1.25rem" }}>{sec.h}</h2>
            {sec.p.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))
      )}
    </div>
  );
}
