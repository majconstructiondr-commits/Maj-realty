import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.quotes.meta, alternates: { canonical: "/cotizaciones" } };
}

export default async function Page() {
  const [s, { d }] = await Promise.all([getSiteSettings(), getI18n()]);
  const t = d.quotes;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>{t.receive}</h2>
            <ul>
              {t.items.map((x) => <li key={x}>{x}</li>)}
              <li>{t.acceptBefore} <Link href="/panel/cotizaciones">{t.acceptLink}</Link>{t.acceptAfter}</li>
            </ul>
            <p className="xs muted">{t.disclaimer}</p>
            <ContactButtons s={s} d={d} servicio="una cotización" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>{t.formTitle}</h2>
            <RequestForm kind="cotizacion" allowFiles filesLabel={t.files} messageLabel={d.form.additionalComments}>
              <fieldset className="fieldset">
                <legend>{t.need}</legend>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cot-serv" className="required">{t.service}</label>
                    <select id="cot-serv" name="servicio" className="select" required defaultValue="">
                      <option value="" disabled>{d.common.select}</option>
                      {Object.entries(t.serviceOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="cot-ref">{t.reference}</label>
                    <input id="cot-ref" name="referencia_inmueble" className="input" maxLength={60} placeholder={t.referencePlaceholder} />
                  </div>
                  <div className="field span-2">
                    <label htmlFor="cot-alc" className="required">{t.scope}</label>
                    <textarea id="cot-alc" name="alcance" className="textarea" required minLength={10} maxLength={2000} />
                  </div>
                </div>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
