import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.contact.meta, alternates: { canonical: "/contacto" } };
}

export default async function Page() {
  const [s, { d }] = await Promise.all([getSiteSettings(), getI18n()]);
  const t = d.contact;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={s["support.response_time_text"]} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <div className="facts" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {s["company.phones"].map((p) => (
                <div key={p} className="box"><span className="box-label">{t.phone}</span><a className="box-value" href={`tel:+1${p.replace(/\D/g, "")}`}>{p}</a></div>
              ))}
              <div className="box"><span className="box-label">WhatsApp</span><a className="box-value" href={whatsappLink(s["whatsapp.primary"])} target="_blank" rel="noopener noreferrer">{t.openChat}</a></div>
              {s["whatsapp.secondary"] ? <div className="box"><span className="box-label">{t.whatsappAlt}</span><a className="box-value" href={whatsappLink(s["whatsapp.secondary"])} target="_blank" rel="noopener noreferrer">{t.openChat}</a></div> : null}
              {s["company.email"] ? <div className="box"><span className="box-label">{t.email}</span><a className="box-value" href={`mailto:${s["company.email"]}`}>{s["company.email"]}</a></div> : null}
              {s["company.address"] ? <div className="box"><span className="box-label">{t.address}</span><span className="box-value">{s["company.address"]}</span></div> : null}
              {s["company.hours"] ? <div className="box"><span className="box-label">{t.hours}</span><span className="box-value">{s["company.hours"]}</span></div> : null}
            </div>
            <ContactButtons s={s} d={d} servicio="sus servicios" formHref="#formulario" />
          </div>
          <div className="card card-body" id="formulario">
            <h2>{t.writeUs}</h2>
            <RequestForm kind="contacto" messageRequired messageLabel={d.form.message}>
              <div className="field">
                <label htmlFor="ct-asunto">{t.subject}</label>
                <input id="ct-asunto" name="asunto" className="input" maxLength={160} />
              </div>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
