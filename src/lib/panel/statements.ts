import type { Currency } from "../format";

export type StatementRow = {
  period: string;
  currency: Currency;
  ingresos: number | string;
  egresos: number | string;
  balance: number | string;
  pendientes_conciliar: number | string;
};

export type StatementGroup = {
  period: string;
  rows: { currency: Currency; ingresos: number; egresos: number; balance: number; pendientes: number }[];
};

const CURRENCY_ORDER: Currency[] = ["DOP", "USD"];

/**
 * Agrupa el estado de cuenta por período (más reciente primero) y dentro de cada período por moneda.
 * Nunca suma importes de monedas distintas: cada moneda queda en su propia fila.
 */
export function groupStatements(rows: StatementRow[]): StatementGroup[] {
  const byPeriod = new Map<string, Map<Currency, StatementGroup["rows"][number]>>();
  for (const r of rows) {
    if (!/^\d{4}-\d{2}$/.test(r.period)) continue;
    const m = byPeriod.get(r.period) ?? new Map();
    const prev = m.get(r.currency) ?? { currency: r.currency, ingresos: 0, egresos: 0, balance: 0, pendientes: 0 };
    prev.ingresos = round2(prev.ingresos + Number(r.ingresos));
    prev.egresos = round2(prev.egresos + Number(r.egresos));
    prev.balance = round2(prev.balance + Number(r.balance));
    prev.pendientes += Number(r.pendientes_conciliar);
    m.set(r.currency, prev);
    byPeriod.set(r.period, m);
  }
  return [...byPeriod.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([period, m]) => ({
      period,
      rows: [...m.values()].sort((a, b) => CURRENCY_ORDER.indexOf(a.currency) - CURRENCY_ORDER.indexOf(b.currency)),
    }));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-09" → "septiembre 2026" */
export function periodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${m[1]}` : period;
}
