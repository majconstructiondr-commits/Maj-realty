import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getEnabledLegalServices } from "@/lib/portfolio";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.legalServices.meta, alternates: { canonical: "/gestiones-legales" } };
}

export default async function Page() {
  const [s, services, { d }] = await Promise.all([getSiteSettings(), getEnabledLegalServices(), getI18n()]);
  const t = d.legalServices;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>{t.process}</h2>
            <ol className="timeline">
              {t.steps.map((p, i) => (
                <li key={p}><strong>{i + 1}. {p}</strong></li>
              ))}
            </ol>
            <div className="alert alert-info small">
              {t.disclaimer}
            </div>
            <ContactButtons s={s} d={d} servicio="gestiones legales de propiedades" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>{t.formTitle}</h2>
            {services.length ? (
              <RequestForm kind="legal" allowFiles filesLabel={t.files} messageLabel={d.form.additionalComments}>
                <fieldset className="fieldset">
                  <legend>{t.yourCase}</legend>
                  <div className="field" role="group" aria-labelledby="leg-srv">
                    <span id="leg-srv" className="label required">{t.servicesNeeded}</span>
                    <span className="hint">{t.pickHint}</span>
                    <div className="service-pick">
                      {services.map((sv) => (
                        <label key={sv.code}>
                          <input type="checkbox" name="service_codes" value={sv.code} />
                          <span>
                            <strong>{sv.name}</strong>
                            {sv.description ? <span className="small muted">{sv.description}</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="leg-ref">{t.reference}</label>
                    <input id="leg-ref" name="referencia_inmueble" className="input" maxLength={60} />
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor="leg-desc" className="required">{t.describe}</label>
                    <textarea id="leg-desc" name="descripcion" className="textarea" required minLength={10} maxLength={2000} />
                  </div>
                </fieldset>
              </RequestForm>
            ) : (
              <div className="stack">
                <p>{t.enabling}</p>
                <ContactButtons s={s} d={d} servicio="gestiones legales de propiedades" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
