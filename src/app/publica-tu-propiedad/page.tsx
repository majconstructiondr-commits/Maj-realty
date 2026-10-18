import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { CurrencySelect, LocationFields, TypeSelect } from "@/components/forms/CommonFields";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.publish.meta, alternates: { canonical: "/publica-tu-propiedad" } };
}

export default async function Page() {
  const { d } = await getI18n();
  const t = d.publish;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section">
        <div className="grid-2">
          <div className="card card-body stack">
            <h2>{t.option1}</h2>
            <p>{t.option1Text}</p>
            <a className="btn btn-primary" href="#captacion">{t.requestAdvisor}</a>
          </div>
          <div className="card card-body stack">
            <h2>{t.option2}</h2>
            <p>
              {t.licenseBefore} <strong>{t.licenseStrong}</strong>{t.licenseAfter}
            </p>
            <ol className="small">
              {t.steps.map((x) => <li key={x}>{x}</li>)}
            </ol>
            <div className="row">
              <Link className="btn btn-gold" href="/cuenta/registro?siguiente=/panel/publicar">{t.createAccount}</Link>
              <Link className="btn btn-ghost" href="/cuenta/ingresar?siguiente=/panel/publicar">{t.haveAccount}</Link>
            </div>
            <p className="xs muted">{t.plans} <Link href="/legal/condiciones-publicacion">{t.conditions}</Link>.</p>
          </div>
        </div>
        <div className="card card-body" id="captacion" style={{ marginTop: 24 }}>
          <h2>{t.formTitle}</h2>
          <RequestForm kind="venta_captacion" allowFiles filesLabel={t.files} messageLabel={t.message}>
            <fieldset className="fieldset">
              <legend>{t.property}</legend>
              <div className="form-grid cols-3">
                <TypeSelect id="cap-tipo" d={d} />
                <LocationFields prefix="cap" d={d} />
                <div className="field">
                  <label htmlFor="cap-precio">{t.expectedPrice}</label>
                  <input id="cap-precio" name="precio_esperado" className="input" inputMode="decimal" />
                </div>
                <CurrencySelect id="cap-mon" d={d} />
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="cap-pref">{t.preferences}</label>
                <textarea id="cap-pref" name="preferencias" className="textarea" maxLength={1000} placeholder={t.preferencesPlaceholder} />
              </div>
              <label className="check" style={{ marginTop: 12 }}>
                <input type="checkbox" name="autorizado" /> <span>{t.authorized}</span>
              </label>
              <label className="check" style={{ marginTop: 8 }}>
                <input type="checkbox" name="visita_evaluacion" defaultChecked /> <span>{t.evaluation}</span>
              </label>
            </fieldset>
          </RequestForm>
        </div>
      </div>
    </>
  );
}
