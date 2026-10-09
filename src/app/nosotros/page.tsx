import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getTeam } from "@/lib/team";
import { getContentBlock } from "@/lib/content";

export const metadata: Metadata = { title: "Nosotros", description: "Conoce a MAJ REALTY SRL, empresa inmobiliaria en República Dominicana.", alternates: { canonical: "/nosotros" } };

export default async function Page() {
  const [s, team, block] = await Promise.all([getSiteSettings(), getTeam(), getContentBlock("nosotros")]);
  return (
    <>
      <PageHero eyebrow="Nosotros" title={block?.title ?? "MAJ REALTY SRL"} lead="Servicios inmobiliarios en República Dominicana: venta, renta, administración, remodelaciones y gestiones de propiedades." />
      <div className="container section" style={{ maxWidth: 900 }}>
        {block?.body ? (
          <div style={{ whiteSpace: "pre-line" }}>{block.body}</div>
        ) : (
          <div className="stack">
            <p className="lead">Trabajamos con procesos claros: cada solicitud queda registrada con número y seguimiento, los documentos se manejan de forma privada y las publicaciones se revisan antes de mostrarse.</p>
            <p className="muted small">La historia de la empresa, la misión y los datos del equipo se publicarán aquí cuando MAJ los confirme.</p>
          </div>
        )}
        {team.length ? (
          <>
            <h2 style={{ marginTop: 32 }}>Equipo</h2>
            <div className="grid-3">
              {team.map((m) => (
                <div key={m.id} className="card card-body center">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.display_name} style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px" }} />
                  ) : null}
                  <strong>{m.display_name}</strong>
                  {m.title ? <p className="small muted" style={{ margin: 0 }}>{m.title}</p> : null}
                  {m.bio ? <p className="small" style={{ marginTop: 8 }}>{m.bio}</p> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ marginTop: 32 }}><ContactButtons s={s} servicio="sus servicios" /></div>
      </div>
    </>
  );
}
