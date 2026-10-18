import { FEATURES, PROVINCES } from "@/lib/catalog/definitions";
import { fmt } from "@/i18n";
import { es, type Dictionary } from "@/i18n/es";
import { activeFilterCount, type SearchFilters } from "@/lib/catalog/search";
import { FiltersPanel } from "./FiltersPanel";

export function Filters({ f, action, d = es }: { f: SearchFilters; action: string; d?: Dictionary }) {
  const n = activeFilterCount(f);
  const t = d.filters;
  const c = d.common;
  return (
    <FiltersPanel>
      <summary>
        {t.title} {n ? <span className="badge badge-gold">{fmt(t.active, { n })}</span> : null}
      </summary>
      <form action={action} method="get" className="form" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="f-q">{t.query}</label>
          <input id="f-q" name="q" className="input" defaultValue={f.q ?? ""} maxLength={80} placeholder={t.queryPlaceholder} />
        </div>
        <div className="field">
          <label htmlFor="f-prov">{c.province}</label>
          <select id="f-prov" name="provincia" className="select" defaultValue={f.provincia ?? ""}>
            <option value="">{c.allF}</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="f-mun">{c.municipality}</label>
            <input id="f-mun" name="municipio" className="input" defaultValue={f.municipio ?? ""} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="f-sec">{c.sector}</label>
            <input id="f-sec" name="sector" className="input" defaultValue={f.sector ?? ""} maxLength={120} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-tipo">{c.propertyType}</label>
          <select id="f-tipo" name="tipo" className="select" defaultValue={f.tipo ?? ""}>
            <option value="">{c.allM}</option>
            {Object.entries(d.labels.propertyTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <fieldset className="fieldset" style={{ padding: 12 }}>
          <legend>{t.price}</legend>
          <div className="field">
            <label htmlFor="f-mon">{c.currency}</label>
            <select id="f-mon" name="moneda" className="select" defaultValue={f.moneda ?? ""}>
              <option value="">{c.any}</option>
              <option value="USD">{c.currencyUSD}</option>
              <option value="DOP">{c.currencyDOP}</option>
            </select>
            <span className="hint">{t.currencyHint}</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-min">{t.min}</label>
              <input id="f-min" name="min" inputMode="numeric" className="input" defaultValue={f.min ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="f-max">{t.max}</label>
              <input id="f-max" name="max" inputMode="numeric" className="input" defaultValue={f.max ?? ""} />
            </div>
          </div>
        </fieldset>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="f-hab">{t.bedrooms}</label>
            <select id="f-hab" name="hab" className="select" defaultValue={f.hab ?? ""}>
              <option value="">{c.any}</option>
              {[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-banos">{t.bathrooms}</label>
            <select id="f-banos" name="banos" className="select" defaultValue={f.banos ?? ""}>
              <option value="">{c.any}</option>
              {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-parq">{t.parking}</label>
            <select id="f-parq" name="parqueos" className="select" defaultValue={f.parqueos ?? ""}>
              <option value="">{c.any}</option>
              {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-m2">{t.area}</label>
            <input id="f-m2" name="m2" inputMode="numeric" className="input" defaultValue={f.m2 ?? ""} />
          </div>
        </div>
        <fieldset className="fieldset" style={{ padding: 12 }}>
          <legend>{t.features}</legend>
          <div className="chip-group">
            {Object.keys(FEATURES).map((k) => (
              <label key={k} className="chip">
                <input type="checkbox" name="car" value={k} defaultChecked={f.car.includes(k)} /> {d.labels.features[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <input type="hidden" name="orden" value={f.orden} />
        <input type="hidden" name="vista" value={f.vista} />
        <div className="row">
          <button className="btn btn-primary" type="submit">{t.apply}</button>
          <a className="btn btn-ghost" href={action}>{c.clear}</a>
        </div>
      </form>
    </FiltersPanel>
  );
}
