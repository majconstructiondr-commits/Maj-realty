import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { CurrencySelect, LocationFields } from "@/components/forms/CommonFields";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getPortfolio } from "@/lib/portfolio";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.remodeling.meta, alternates: { canonical: "/remodelaciones" } };
}

export default async function Page() {
  const [s, portfolio, { d }] = await Promise.all([getSiteSettings(), getPortfolio(), getI18n()]);
  const t = d.remodeling;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>{t.how}</h2>
            <ol className="steps" style={{ gridTemplateColumns: "1fr" }}>
              {t.steps.map((st) => (
                <li key={st.h} className="card"><h3>{st.h}</h3><p className="small muted">{st.p}</p></li>
              ))}
            </ol>
            {portfolio.length ? (
              <>
                <h2 style={{ marginTop: 24 }}>{t.portfolio}</h2>
                <div className="grid-2">
                  {portfolio.map((p) => (
                    <figure key={p.id} className="card" style={{ margin: 0, overflow: "hidden" }}>
                      <div className="grid-2" style={{ gap: 2 }}>
                        {p.before_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.before_url} alt={`${p.title}: ${t.before}`} style={{ aspectRatio: "4/3", objectFit: "cover", width: "100%" }} />
                        ) : null}
                        {p.after_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.after_url} alt={`${p.title}: ${t.after}`} style={{ aspectRatio: "4/3", objectFit: "cover", width: "100%" }} />
                        ) : null}
                      </div>
                      <figcaption className="card-body">
                        <strong>{p.title}</strong>
                        {p.location_summary ? <span className="small muted"> · {p.location_summary}</span> : null}
                        {p.description ? <p className="small muted" style={{ margin: "6px 0 0" }}>{p.description}</p> : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            ) : null}
            <ContactButtons s={s} d={d} servicio="una remodelación" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>{t.formTitle}</h2>
            <RequestForm kind="remodelacion" allowFiles filesLabel={t.files} messageLabel={d.form.additionalComments}>
              <fieldset className="fieldset">
                <legend>{t.work}</legend>
                <div className="form-grid">
                  <div className="field span-2">
                    <label htmlFor="rem-tipo" className="required">{t.workType}</label>
                    <input id="rem-tipo" name="tipo_trabajo" className="input" required minLength={2} maxLength={120} placeholder={t.workTypePlaceholder} />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-area">{t.area}</label>
                    <input id="rem-area" name="area_m2" type="number" min={0} step="0.5" className="input" />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-urg">{t.urgency}</label>
                    <select id="rem-urg" name="urgencia" className="select" defaultValue="normal">
                      {Object.entries(t.urgencyOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field span-2">
                    <label htmlFor="rem-alc">{t.scope}</label>
                    <textarea id="rem-alc" name="alcance" className="textarea" maxLength={2000} placeholder={t.scopePlaceholder} />
                  </div>
                  <div className="field">
                    <label htmlFor="rem-pres">{t.budget}</label>
                    <input id="rem-pres" name="presupuesto" className="input" inputMode="decimal" />
                  </div>
                  <CurrencySelect id="rem-mon" d={d} />
                  <LocationFields prefix="rem" d={d} />
                  <div className="field">
                    <label htmlFor="rem-fecha">{t.date}</label>
                    <input id="rem-fecha" name="fecha_deseada" type="date" className="input" />
                  </div>
                </div>
                <label className="check" style={{ marginTop: 12 }}>
                  <input type="checkbox" name="visita_tecnica" defaultChecked /> <span>{t.visit}</span>
                </label>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
