import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_DOCS } from "@/lib/legal/drafts";

export const metadata: Metadata = { title: "Documentos legales", alternates: { canonical: "/legal" } };

export default function Page() {
  return (
    <div className="container section" style={{ maxWidth: 860 }}>
      <h1>Documentos legales</h1>
      <p className="alert alert-warning">Borradores pendientes de revisión por un abogado dominicano. No están aprobados jurídicamente.</p>
      <div className="grid-2" style={{ marginTop: 16 }}>
        {Object.entries(LEGAL_DOCS).map(([k, d]) => (
          <Link key={k} href={`/legal/${k}`} className="card card-body" style={{ textDecoration: "none", color: "inherit" }}>
            <h3>{d.title}</h3>
            <p className="small muted" style={{ margin: 0 }}>{d.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
