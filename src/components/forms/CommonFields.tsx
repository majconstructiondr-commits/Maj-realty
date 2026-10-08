import { PROPERTY_TYPES, PROVINCES } from "@/lib/catalog/definitions";

export function TypeSelect({ id, name = "tipo", required = false, label = "Tipo de inmueble" }: { id: string; name?: string; required?: boolean; label?: string }) {
  return (
    <div className="field">
      <label htmlFor={id} className={required ? "required" : undefined}>{label}</label>
      <select id={id} name={name} className="select" defaultValue="" required={required}>
        <option value="">Seleccione…</option>
        {Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

export function LocationFields({ prefix }: { prefix: string }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-prov`}>Provincia</label>
        <select id={`${prefix}-prov`} name="provincia" className="select" defaultValue="">
          <option value="">Seleccione…</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-mun`}>Municipio</label>
        <input id={`${prefix}-mun`} name="municipio" className="input" maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-sec`}>Sector</label>
        <input id={`${prefix}-sec`} name="sector" className="input" maxLength={120} />
        <span className="hint">No es necesario indicar la dirección exacta en este paso.</span>
      </div>
    </>
  );
}

export function MoneyFields({ prefix, amountName, label }: { prefix: string; amountName: string; label: string }) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-amt`}>{label}</label>
        <input id={`${prefix}-amt`} name={amountName} className="input" inputMode="decimal" />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-cur`}>Moneda</label>
        <select id={`${prefix}-cur`} name="moneda" className="select" defaultValue="">
          <option value="">Seleccione…</option>
          <option value="DOP">Pesos (RD$)</option>
          <option value="USD">Dólares (US$)</option>
        </select>
      </div>
    </>
  );
}
