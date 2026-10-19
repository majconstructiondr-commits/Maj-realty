import { getI18n } from "@/i18n/server";
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
export async function QuoteHeaderFields({ v, disabled = false }: { v: QuoteHeaderValues; disabled?: boolean }) {
  const { d } = await getI18n();
  const t = d.admin.quoteForm;
  const pct = v.tax_rate != null && v.tax_rate !== "" ? Math.round(Number(v.tax_rate) * 10000) / 100 : "";
  return (
    <>
      <fieldset className="fieldset" disabled={disabled}>
        <legend>{t.client}</legend>
        <input type="hidden" name="client_user_id" value={v.client_user_id ?? ""} />
        <p className="small">
          {t.linked} {v.client_user_id ? <strong>{v.client_label ?? t.user}</strong> : t.noAccount}
        </p>
        <div className="form-grid">
          <div className="field"><label htmlFor="q-cn" className="required">{t.clientName}</label><input id="q-cn" name="client_name" className="input" required minLength={2} maxLength={160} defaultValue={v.client_name ?? ""} /></div>
          <div className="field">
            <label htmlFor="q-ce">{t.linkByEmail}</label>
            <input id="q-ce" name="client_email" type="email" className="input" maxLength={160} placeholder={t.emailPlaceholder} />
            <span className="hint">{t.linkHint}</span>
          </div>
          {v.client_user_id && <label className="check"><input type="checkbox" name="unlink_client" /> {t.unlink}</label>}
        </div>
      </fieldset>
      <fieldset className="fieldset" disabled={disabled}>
        <legend>{t.quote}</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="q-t" className="required">{t.title}</label><input id="q-t" name="title" className="input" required minLength={3} maxLength={200} defaultValue={v.title ?? ""} /></div>
          <div className="field">
            <label htmlFor="q-s" className="required">{t.service}</label>
            <select id="q-s" name="service" className="select" defaultValue={v.service ?? "otro"}>{Object.entries(d.status.quoteServices).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="q-c" className="required">{t.currency}</label>
            <select id="q-c" name="currency" className="select" defaultValue={v.currency ?? "DOP"}><option value="DOP">{t.currencyDOP}</option><option value="USD">{t.currencyUSD}</option></select>
          </div>
          <div className="field"><label htmlFor="q-v">{t.validUntil}</label><input id="q-v" name="valid_until" type="date" className="input" defaultValue={v.valid_until ?? ""} /><span className="hint">{t.validHint}</span></div>
          <div className="field"><label htmlFor="q-tl">{t.taxLabel}</label><input id="q-tl" name="tax_label" className="input" maxLength={40} defaultValue={v.tax_label ?? ""} placeholder={t.taxPlaceholder} /></div>
          <div className="field"><label htmlFor="q-tr">{t.taxRate}</label><input id="q-tr" name="tax_percent" type="number" min={0} max={99.99} step="0.01" className="input" defaultValue={pct} /><span className="hint">{t.taxHint}</span></div>
        </div>
        <div className="field"><label htmlFor="q-sc">{t.scope}</label><textarea id="q-sc" name="scope" className="textarea" maxLength={4000} defaultValue={v.scope ?? ""} /></div>
        <div className="field"><label htmlFor="q-ex">{t.exclusions}</label><textarea id="q-ex" name="exclusions" className="textarea" maxLength={4000} defaultValue={v.exclusions ?? ""} /></div>
        <div className="field"><label htmlFor="q-co">{t.conditions}</label><textarea id="q-co" name="conditions" className="textarea" maxLength={4000} defaultValue={v.conditions ?? ""} /></div>
      </fieldset>
      <StagesEditor initial={v.stages ?? []} disabled={disabled} />
    </>
  );
}
