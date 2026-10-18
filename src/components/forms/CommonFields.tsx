import { PROVINCES } from "@/lib/catalog/definitions";
import { es, type Dictionary } from "@/i18n/es";

export function TypeSelect({ id, name = "tipo", required = false, label, d = es }: { id: string; name?: string; required?: boolean; label?: string; d?: Dictionary }) {
  return (
    <div className="field">
      <label htmlFor={id} className={required ? "required" : undefined}>{label ?? d.common.propertyType}</label>
      <select id={id} name={name} className="select" defaultValue="" required={required}>
        <option value="">{d.common.select}</option>
        {Object.entries(d.labels.propertyTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

export function LocationFields({ prefix, d = es }: { prefix: string; d?: Dictionary }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-prov`}>{d.common.province}</label>
        <select id={`${prefix}-prov`} name="provincia" className="select" defaultValue="">
          <option value="">{d.common.select}</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-mun`}>{d.common.municipality}</label>
        <input id={`${prefix}-mun`} name="municipio" className="input" maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-sec`}>{d.common.sector}</label>
        <input id={`${prefix}-sec`} name="sector" className="input" maxLength={120} />
        <span className="hint">{d.form.exactAddressHint}</span>
      </div>
    </>
  );
}

/** Moneda: pesos o dólares (los importes nunca se mezclan). */
export function CurrencySelect({ id, d = es }: { id: string; d?: Dictionary }) {
  return (
    <div className="field">
      <label htmlFor={id}>{d.common.currency}</label>
      <select id={id} name="moneda" className="select" defaultValue="">
        <option value="">{d.common.select}</option>
        <option value="DOP">{d.common.currencyDOP}</option>
        <option value="USD">{d.common.currencyUSD}</option>
      </select>
    </div>
  );
}

export function MoneyFields({ prefix, amountName, label, d = es }: { prefix: string; amountName: string; label: string; d?: Dictionary }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-amt`}>{label}</label>
        <input id={`${prefix}-amt`} name={amountName} className="input" inputMode="decimal" />
      </div>
      <CurrencySelect id={`${prefix}-cur`} d={d} />
    </>
  );
}
