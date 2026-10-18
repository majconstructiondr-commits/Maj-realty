import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS } from "@/lib/legal/drafts";
import { getContentBlock } from "@/lib/content";
import { getSiteSettings } from "@/lib/site";
import { getI18n } from "@/i18n/server";

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata(props: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await props.params;
  const d = LEGAL_DOCS[doc];
  return d ? { title: d.title, alternates: { canonical: `/legal/${doc}` } } : { title: "Documento no encontrado" };
}

export default async function Page(props: PageProps<"/legal/[doc]">) {
  const { doc } = await props.params;
  const d = LEGAL_DOCS[doc];
  if (!d) notFound();
  const [override, s, { d: t }] = await Promise.all([getContentBlock(`legal.${doc}`), getSiteSettings(), getI18n()]);
  return (
    <div className="container section" style={{ maxWidth: 860 }} lang="es-DO">
      {t.legal.note ? <p className="alert alert-info small" lang={t.meta.htmlLang}>{t.legal.note}</p> : null}
      <nav className="small"><Link href="/legal">← Documentos legales</Link></nav>
      <h1>{override?.title ?? d.title}</h1>
      <p className="alert alert-warning small">
        Borrador ({s["legal.documents_version"]}) sujeto a revisión de abogado dominicano. No está aprobado jurídicamente.
      </p>
      {override?.body ? (
        <div style={{ whiteSpace: "pre-line" }}>{override.body}</div>
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
