import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS } from "@/lib/legal/drafts";
import { getContentBlock } from "@/lib/content";
import { getSiteSettings } from "@/lib/site";

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
  const [override, s] = await Promise.all([getContentBlock(`legal.${doc}`), getSiteSettings()]);
  return (
    <div className="container section" style={{ maxWidth: 860 }}>
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
