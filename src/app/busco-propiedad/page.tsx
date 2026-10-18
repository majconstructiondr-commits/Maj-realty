import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { RequestForm } from "@/components/forms/RequestForm";
import { CurrencySelect, TypeSelect } from "@/components/forms/CommonFields";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { ...d.wanted.meta, alternates: { canonical: "/busco-propiedad" } };
}

export default async function Page(props: PageProps<"/busco-propiedad">) {
  const sp = await props.searchParams;
  const op = sp.operacion === "renta" ? "renta" : "venta";
  const { d } = await getI18n();
  const t = d.wanted;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className="container section" style={{ maxWidth: 820 }}>
        <div className="card card-body">
          <RequestForm kind="busco_propiedad" submitLabel={t.submit} messageLabel={t.message}>
            <fieldset className="fieldset">
              <legend>{t.legend}</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="bp-op" className="required">{t.operation}</label>
                  <select id="bp-op" name="operacion" className="select" defaultValue={op} required>
                    <option value="venta">{t.buy}</option>
                    <option value="renta">{t.rent}</option>
                  </select>
                </div>
                <TypeSelect id="bp-tipo" d={d} />
                <div className="field span-2">
                  <label htmlFor="bp-zonas" className="required">{t.zones}</label>
                  <input id="bp-zonas" name="zonas" className="input" required minLength={2} maxLength={300} placeholder={t.zonesPlaceholder} />
                </div>
                <div className="field">
                  <label htmlFor="bp-pres">{t.budget}</label>
                  <input id="bp-pres" name="presupuesto_max" className="input" inputMode="decimal" />
                </div>
                <CurrencySelect id="bp-mon" d={d} />
                <div className="field">
                  <label htmlFor="bp-hab">{t.bedrooms}</label>
                  <input id="bp-hab" name="habitaciones" type="number" min={0} max={20} className="input" />
                </div>
                <div className="field">
                  <label htmlFor="bp-fecha">{t.when}</label>
                  <input id="bp-fecha" name="fecha" type="date" className="input" />
                </div>
              </div>
            </fieldset>
          </RequestForm>
        </div>
      </div>
    </>
  );
}
