import { FEATURES, PROPERTY_TYPES, PROVINCES } from "@/lib/catalog/definitions";
import { activeFilterCount, type SearchFilters } from "@/lib/catalog/search";

export function Filters({ f, action }: { f: SearchFilters; action: string }) {
  const n = activeFilterCount(f);
  return (
    <details className="card filters" open>
      <summary>
        Filtros {n ? <span className="badge badge-gold">{n} activos</span> : null}
      </summary>
      <form action={action} method="get" className="form" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="f-q">Referencia o palabra clave</label>
          <input id="f-q" name="q" className="input" defaultValue={f.q ?? ""} maxLength={80} placeholder="MAJ-001023, Naco…" />
        </div>
        <div className="field">
          <label htmlFor="f-prov">Provincia</label>
          <select id="f-prov" name="provincia" className="select" defaultValue={f.provincia ?? ""}>
            <option value="">Todas</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="f-mun">Municipio</label>
            <input id="f-mun" name="municipio" className="input" defaultValue={f.municipio ?? ""} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="f-sec">Sector</label>
            <input id="f-sec" name="sector" className="input" defaultValue={f.sector ?? ""} maxLength={120} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-tipo">Tipo de inmueble</label>
          <select id="f-tipo" name="tipo" className="select" defaultValue={f.tipo ?? ""}>
            <option value="">Todos</option>
            {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <fieldset className="fieldset" style={{ padding: 12 }}>
          <legend>Precio</legend>
          <div className="field">
            <label htmlFor="f-mon">Moneda</label>
            <select id="f-mon" name="moneda" className="select" defaultValue={f.moneda ?? ""}>
              <option value="">Cualquiera</option>
              <option value="USD">Dólares (US$)</option>
              <option value="DOP">Pesos (RD$)</option>
            </select>
            <span className="hint">Los precios se filtran en su moneda original.</span>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="f-min">Mínimo</label>
              <input id="f-min" name="min" inputMode="numeric" className="input" defaultValue={f.min ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="f-max">Máximo</label>
              <input id="f-max" name="max" inputMode="numeric" className="input" defaultValue={f.max ?? ""} />
            </div>
          </div>
        </fieldset>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="f-hab">Habitaciones (mín.)</label>
            <select id="f-hab" name="hab" className="select" defaultValue={f.hab ?? ""}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-banos">Baños (mín.)</label>
            <select id="f-banos" name="banos" className="select" defaultValue={f.banos ?? ""}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-parq">Parqueos (mín.)</label>
            <select id="f-parq" name="parqueos" className="select" defaultValue={f.parqueos ?? ""}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4].map((x) => <option key={x} value={x}>{x}+</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-m2">Superficie mín. (m²)</label>
            <input id="f-m2" name="m2" inputMode="numeric" className="input" defaultValue={f.m2 ?? ""} />
          </div>
        </div>
        <fieldset className="fieldset" style={{ padding: 12 }}>
          <legend>Características</legend>
          <div className="chip-group">
            {Object.entries(FEATURES).map(([k, d]) => (
              <label key={k} className="chip">
                <input type="checkbox" name="car" value={k} defaultChecked={f.car.includes(k)} /> {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <input type="hidden" name="orden" value={f.orden} />
        <input type="hidden" name="vista" value={f.vista} />
        <div className="row">
          <button className="btn btn-primary" type="submit">Aplicar filtros</button>
          <a className="btn btn-ghost" href={action}>Limpiar</a>
        </div>
      </form>
    </details>
  );
}
