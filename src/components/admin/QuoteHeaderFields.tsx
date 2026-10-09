import { QUOTE_SERVICES } from "@/lib/admin/labels";
import { StagesEditor, type QuoteStage } from "./StagesEditor";

export type QuoteHeaderValues = {
  client_user_id?: string | null;
  client_label?: string | null;
  client_name?: string;
  service?: string;
  title?: string;
  currency?: string;
  tax_label?: string | null;
  tax_rate?: number | string | null;
  valid_until?: string | null;
  scope?: string | null;
  exclusions?: string | null;
  conditions?: string | null;
  stages?: QuoteStage[];
};

/** Campos del encabezado de una cotización (nueva o borrador). */
export function QuoteHeaderFields({ v, disabled = false }: { v: QuoteHeaderValues; disabled?: boolean }) {
  const pct = v.tax_rate != null && v.tax_rate !== "" ? Math.round(Number(v.tax_rate) * 10000) / 100 : "";
  return (
    <>
      <fieldset className="fieldset" disabled={disabled}>
        <legend>Cliente</legend>
        <input type="hidden" name="client_user_id" value={v.client_user_id ?? ""} />
        <p className="small">
          Cuenta vinculada: {v.client_user_id ? <strong>{v.client_label ?? "Usuario"}</strong> : "ninguna (la cotización se entrega por otro canal)"}
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="q-cn" className="required">Nombre del cliente</label><input id="q-cn" name="client_name" className="input" required minLength={2} maxLength={160} defaultValue={v.client_name ?? ""} /></div>
          <div className="field">
            <label htmlFor="q-ce">Vincular cuenta por correo</label>
            <input id="q-ce" name="client_email" type="email" className="input" maxLength={160} placeholder="correo@cliente.com" />
            <span className="hint">Solo cuentas registradas. Con cuenta vinculada el cliente ve y responde la cotización en su panel.</span>
          </div>
          {v.client_user_id && <label className="check"><input type="checkbox" name="unlink_client" /> Desvincular la cuenta actual</label>}
        </div>
      </fieldset>
      <fieldset className="fieldset" disabled={disabled}>
        <legend>Cotización</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="q-t" className="required">Título</label><input id="q-t" name="title" className="input" required minLength={3} maxLength={200} defaultValue={v.title ?? ""} /></div>
          <div className="field">
            <label htmlFor="q-s" className="required">Servicio</label>
            <select id="q-s" name="service" className="select" defaultValue={v.service ?? "otro"}>{Object.entries(QUOTE_SERVICES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="q-c" className="required">Moneda</label>
            <select id="q-c" name="currency" className="select" defaultValue={v.currency ?? "DOP"}><option value="DOP">Pesos dominicanos (RD$)</option><option value="USD">Dólares (US$)</option></select>
          </div>
          <div className="field"><label htmlFor="q-v">Válida hasta</label><input id="q-v" name="valid_until" type="date" className="input" defaultValue={v.valid_until ?? ""} /><span className="hint">Obligatoria para enviar.</span></div>
          <div className="field"><label htmlFor="q-tl">Impuesto (etiqueta)</label><input id="q-tl" name="tax_label" className="input" maxLength={40} defaultValue={v.tax_label ?? ""} placeholder="p. ej. ITBIS" /></div>
          <div className="field"><label htmlFor="q-tr">Tasa de impuesto (%)</label><input id="q-tr" name="tax_percent" type="number" min={0} max={99.99} step="0.01" className="input" defaultValue={pct} /><span className="hint">Configure el valor por defecto con su contador en Configuración.</span></div>
        </div>
        <div className="field"><label htmlFor="q-sc">Alcance</label><textarea id="q-sc" name="scope" className="textarea" maxLength={4000} defaultValue={v.scope ?? ""} /></div>
        <div className="field"><label htmlFor="q-ex">Exclusiones</label><textarea id="q-ex" name="exclusions" className="textarea" maxLength={4000} defaultValue={v.exclusions ?? ""} /></div>
        <div className="field"><label htmlFor="q-co">Condiciones</label><textarea id="q-co" name="conditions" className="textarea" maxLength={4000} defaultValue={v.conditions ?? ""} /></div>
      </fieldset>
      <StagesEditor initial={v.stages ?? []} disabled={disabled} />
    </>
  );
}
