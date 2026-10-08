import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Contacto", description: "Contacta a MAJ REALTY SRL por teléfono, WhatsApp o formulario.", alternates: { canonical: "/contacto" } };

export default async function Page() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Contacto" title="Hablemos" lead={s["support.response_time_text"]} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <div className="facts" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {s["company.phones"].map((p) => (
                <div key={p} className="box"><span className="box-label">Teléfono</span><a className="box-value" href={`tel:+1${p.replace(/\D/g, "")}`}>{p}</a></div>
              ))}
              <div className="box"><span className="box-label">WhatsApp principal</span><a className="box-value" href={whatsappLink(s["whatsapp.primary"])} target="_blank" rel="noopener noreferrer">Abrir chat</a></div>
              <div className="box"><span className="box-label">WhatsApp alternativo</span><a className="box-value" href={whatsappLink(s["whatsapp.secondary"])} target="_blank" rel="noopener noreferrer">Abrir chat</a></div>
              {s["company.email"] ? <div className="box"><span className="box-label">Correo</span><a className="box-value" href={`mailto:${s["company.email"]}`}>{s["company.email"]}</a></div> : null}
              {s["company.address"] ? <div className="box"><span className="box-label">Dirección</span><span className="box-value">{s["company.address"]}</span></div> : null}
              {s["company.hours"] ? <div className="box"><span className="box-label">Horario</span><span className="box-value">{s["company.hours"]}</span></div> : null}
            </div>
            <ContactButtons s={s} servicio="sus servicios" formHref="#formulario" />
          </div>
          <div className="card card-body" id="formulario">
            <h2>Escríbenos</h2>
            <RequestForm kind="contacto" messageRequired messageLabel="Mensaje">
              <div className="field">
                <label htmlFor="ct-asunto">Asunto</label>
                <input id="ct-asunto" name="asunto" className="input" maxLength={160} />
              </div>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
