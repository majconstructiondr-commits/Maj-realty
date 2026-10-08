// Formatos de moneda, fechas y números para República Dominicana.
export const TZ = "America/Santo_Domingo";
export type Currency = "DOP" | "USD";

const currencyPrefix: Record<Currency, string> = { DOP: "RD$", USD: "US$" };

/** Importe en su moneda original. Nunca se mezclan monedas. */
export function formatMoney(amount: number | string | null | undefined, currency: Currency, opts?: { decimals?: boolean }) {
  if (amount === null || amount === undefined || amount === "") return "Precio a consultar";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "Precio a consultar";
  const decimals = opts?.decimals ?? !Number.isInteger(n);
  const s = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(n);
  return `${currencyPrefix[currency]} ${s}`;
}

export function formatNumber(n: number | string | null | undefined, decimals = 0) {
  if (n === null || n === undefined || n === "") return "";
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: decimals }).format(Number(n));
}

export function formatDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}

export function formatDateLong(d: string | Date) {
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return new Intl.DateTimeFormat("es-DO", { timeZone: TZ, dateStyle: "long" }).format(date);
}

/** Convierte una fecha/hora local de Santo Domingo ("2026-10-13T10:00") a ISO UTC. RD no usa horario de verano (UTC-4). */
export function localDateTimeToIso(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error("Fecha no válida");
  return new Date(`${local}:00-04:00`).toISOString();
}

/** Conversión orientativa con tasa registrada (fuente y fecha obligatorias). */
export function convert(amount: number, rate: { base: Currency; quote: Currency; rate: number }, from: Currency) {
  if (from === rate.base) return { amount: amount * rate.rate, currency: rate.quote };
  if (from === rate.quote) return { amount: amount / rate.rate, currency: rate.base };
  return null;
}

/** Suma por moneda (nunca entre monedas distintas). */
export function totalsByCurrency(items: { amount: number | string; currency: Currency }[]) {
  const out: Partial<Record<Currency, number>> = {};
  for (const i of items) out[i.currency] = Math.round(((out[i.currency] ?? 0) + Number(i.amount)) * 100) / 100;
  return out;
}
