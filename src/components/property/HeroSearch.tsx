"use client";
import { useState } from "react";
import { PROPERTY_TYPES, PROVINCES } from "@/lib/catalog/definitions";

export function HeroSearch() {
  const [op, setOp] = useState<"venta" | "renta">("venta");
  return (
    <form className="hero-search" action={`/${op}`} method="get" role="search" aria-label="Buscar inmuebles">
      <div className="tabs" role="tablist" aria-label="Operación">
        {(["venta", "renta"] as const).map((o) => (
          <button key={o} type="button" role="tab" aria-selected={op === o} className="tab" onClick={() => setOp(o)}>
            {o === "venta" ? "Comprar" : "Rentar"}
          </button>
        ))}
      </div>
      <div className="grid-search">
        <div className="field">
          <label htmlFor="hs-q">Referencia, sector o palabra clave</label>
          <input id="hs-q" name="q" className="input" placeholder="Ej.: MAJ-001023 o Piantini" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="hs-prov">Provincia</label>
          <select id="hs-prov" name="provincia" className="select" defaultValue="">
            <option value="">Todas</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hs-tipo">Tipo</label>
          <select id="hs-tipo" name="tipo" className="select" defaultValue="">
            <option value="">Todos</option>
            {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="hs-max">Precio máximo</label>
          <input id="hs-max" name="max" inputMode="numeric" className="input" placeholder="Sin límite" />
        </div>
        <button className="btn btn-gold" type="submit">Buscar</button>
      </div>
    </form>
  );
}
