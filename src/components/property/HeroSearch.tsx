"use client";
import { useState } from "react";
import { PROVINCES } from "@/lib/catalog/definitions";
import { useI18n } from "@/i18n/client";

export function HeroSearch() {
  const [op, setOp] = useState<"venta" | "renta">("venta");
  const { d } = useI18n();
  const t = d.search;
  return (
    <form className="hero-search" action={`/${op}`} method="get" role="search" aria-label={t.aria}>
      <div className="tabs" role="tablist" aria-label={t.operation}>
        {(["venta", "renta"] as const).map((o) => (
          <button key={o} type="button" role="tab" aria-selected={op === o} className="tab" onClick={() => setOp(o)}>
            {o === "venta" ? t.buy : t.rent}
          </button>
        ))}
      </div>
      <div className="grid-search">
        <div className="field">
          <label htmlFor="hs-q">{t.query}</label>
          <input id="hs-q" name="q" className="input" placeholder={t.queryPlaceholder} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="hs-prov">{d.common.province}</label>
          <select id="hs-prov" name="provincia" className="select" defaultValue="">
            <option value="">{d.common.allF}</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hs-tipo">{t.type}</label>
          <select id="hs-tipo" name="tipo" className="select" defaultValue="">
            <option value="">{d.common.allM}</option>
            {Object.entries(d.labels.propertyTypes).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hs-max">{t.maxPrice}</label>
          <input id="hs-max" name="max" inputMode="numeric" className="input" placeholder={t.noLimit} />
        </div>
        <button className="btn btn-gold" type="submit">{d.common.search}</button>
      </div>
    </form>
  );
}
