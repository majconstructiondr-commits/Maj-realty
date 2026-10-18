import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { LocationFields, TypeSelect } from "@/components/forms/CommonFields";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { getSiteSettings } from "@/lib/site";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.management.meta, alternates: { canonical: "/administracion" } };
}

export default async function Page() {
  const [s, { d }] = await Promise.all([getSiteSettings(), getI18n()]);
  const t = d.management;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section">
        <div className="detail-layout">
          <div className="stack">
            <h2>{t.includes}</h2>
            <div className="grid-2">
              {t.items.map((it) => (
                <div key={it.h} className="card card-body"><h3>{it.h}</h3><p className="small muted" style={{ margin: 0 }}>{it.p}</p></div>
              ))}
            </div>
            <p className="xs muted">
              {t.disclaimer}
            </p>
            <p className="small">{t.clientQuestion} <Link href="/panel/administracion">{t.clientLink}</Link>.</p>
            <ContactButtons s={s} d={d} servicio="el servicio de administración de propiedades" formHref="#solicitud" />
          </div>
          <div className="card card-body" id="solicitud">
            <h2>{t.formTitle}</h2>
            <RequestForm kind="administracion" allowFiles filesLabel={t.files} messageLabel={d.form.additionalComments}>
              <fieldset className="fieldset">
                <legend>{t.property}</legend>
                <div className="form-grid">
                  <TypeSelect id="adm-tipo" d={d} />
                  <div className="field">
                    <label htmlFor="adm-unid">{t.units}</label>
                    <input id="adm-unid" name="unidades" type="number" min={1} max={10000} className="input" />
                  </div>
                  <LocationFields prefix="adm" d={d} />
                  <div className="field">
                    <label htmlFor="adm-ocup">{t.occupancy}</label>
                    <select id="adm-ocup" name="ocupacion" className="select" defaultValue="">
                      <option value="">{d.common.select}</option>
                      {Object.entries(t.occupancyOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field" style={{ marginTop: 14 }}>
                  <span className="label">{t.servicesLabel}</span>
                  <div className="chip-group">
                    {Object.entries(t.servicesOptions).map(([k, v]) => (
                      <label key={k} className="chip"><input type="checkbox" name="servicios" value={k} /> {v}</label>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="adm-sit">{t.situation}</label>
                  <textarea id="adm-sit" name="situacion_actual" className="textarea" maxLength={1000} placeholder={t.situationPlaceholder} />
                </div>
              </fieldset>
            </RequestForm>
          </div>
        </div>
      </div>
    </>
  );
}
