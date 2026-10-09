"use client";
import { useMemo, useState } from "react";
import { mortgage } from "@/lib/mortgage";
import { formatMoney, type Currency } from "@/lib/format";

export function MortgageCalculator() {
  const [v, setV] = useState({ price: "", down: "", rate: "", years: "20", currency: "USD" as Currency });
  const n = (s: string) => Number(s.replace(/[,\s]/g, ""));
  const res = useMemo(() => mortgage({ price: n(v.price), downPayment: n(v.down || "0"), annualRatePct: n(v.rate), years: n(v.years) }), [v]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <div className="card card-body">
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-grid">
          <div className="field"><label htmlFor="mc-cur">Moneda</label>
            <select id="mc-cur" className="select" value={v.currency} onChange={set("currency")}><option value="USD">Dólares (US$)</option><option value="DOP">Pesos (RD$)</option></select></div>
          <div className="field"><label htmlFor="mc-price">Precio del inmueble</label><input id="mc-price" className="input" inputMode="decimal" value={v.price} onChange={set("price")} /></div>
          <div className="field"><label htmlFor="mc-down">Inicial</label><input id="mc-down" className="input" inputMode="decimal" value={v.down} onChange={set("down")} /></div>
          <div className="field"><label htmlFor="mc-rate">Interés anual (%)</label><input id="mc-rate" className="input" inputMode="decimal" value={v.rate} onChange={set("rate")} />
            <span className="hint">Introduce la tasa que te ofrezca tu entidad. No mostramos tasas vigentes.</span></div>
          <div className="field"><label htmlFor="mc-years">Plazo (años)</label><input id="mc-years" className="input" inputMode="numeric" value={v.years} onChange={set("years")} /></div>
        </div>
      </form>
      <div aria-live="polite" style={{ marginTop: 16 }}>
        {res ? (
          <div className="facts">
            <div className="box"><span className="box-label">Monto a financiar</span><span className="box-value">{formatMoney(res.principal, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">Cuota mensual estimada</span><span className="box-value">{formatMoney(res.monthlyPayment, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">Intereses totales</span><span className="box-value">{formatMoney(res.totalInterest, v.currency, { decimals: true })}</span></div>
            <div className="box"><span className="box-label">Número de cuotas</span><span className="box-value">{res.months}</span></div>
          </div>
        ) : (
          <p className="muted small">Completa precio, inicial, interés y plazo para ver el resultado.</p>
        )}
      </div>
      <p className="xs muted" style={{ marginTop: 14 }}>
        Supuestos: cuota fija con interés compuesto mensual durante todo el plazo. No incluye seguros, comisiones, gastos de cierre, impuestos ni otros cargos no suministrados. No es una oferta ni una aprobación bancaria.
      </p>
    </div>
  );
}
