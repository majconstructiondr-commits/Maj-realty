"use client";
import { useMemo, useState } from "react";
import { mortgage } from "@/lib/mortgage";
import { formatMoney, type Currency } from "@/lib/format";
import { useI18n } from "@/i18n/client";

export function MortgageCalculator() {
  const [v, setV] = useState({ price: "", down: "", rate: "", years: "20", currency: "USD" as Currency });
  const n = (s: string) => Number(s.replace(/[,\s]/g, ""));
  const res = useMemo(() => mortgage({ price: n(v.price), downPayment: n(v.down || "0"), annualRatePct: n(v.rate), years: n(v.years) }), [v]);
  const { d } = useI18n();
  const t = d.mortgage;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="card card-body">
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-grid">
          <div className="field"><label htmlFor="mc-cur">{d.common.currency}</label>
            <select id="mc-cur" className="select" value={v.currency} onChange={set("currency")}><option value="USD">{d.common.currencyUSD}</option><option value="DOP">{d.common.currencyDOP}</option></select></div>
          <div className="field"><label htmlFor="mc-price">{t.price}</label><input id="mc-price" className="input" inputMode="decimal" value={v.price} onChange={set("price")} /></div>
          <div className="field"><label htmlFor="mc-down">{t.down}</label><input id="mc-down" className="input" inputMode="decimal" value={v.down} onChange={set("down")} /></div>
          <div className="field"><label htmlFor="mc-rate">{t.rate}</label><input id="mc-rate" className="input" inputMode="decimal" value={v.rate} onChange={set("rate")} />
            <span className="hint">{t.rateHint}</span></div>
          <div className="field"><label htmlFor="mc-years">{t.years}</label><input id="mc-years" className="input" inputMode="numeric" value={v.years} onChange={set("years")} /></div>
        </div>
      </form>
      <div aria-live="polite" style={{ marginTop: 16 }}>
        {res ? (
          <div className="facts">
            <div className="box"><span className="box-label">{t.principal}</span><span className="box-value">{formatMoney(res.principal, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">{t.monthly}</span><span className="box-value">{formatMoney(res.monthlyPayment, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">{t.interest}</span><span className="box-value">{formatMoney(res.totalInterest, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">{t.payments}</span><span className="box-value">{res.months}</span></div>
          </div>
        ) : (
          <p className="muted small">{t.incomplete}</p>
        )}
      </div>
      <p className="xs muted" style={{ marginTop: 14 }}>
        {t.assumptions}
      </p>
    </div>
  );
}
