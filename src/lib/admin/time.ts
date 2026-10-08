// Fechas en hora de Santo Domingo (UTC-4 todo el año, sin horario de verano).
const OFFSET_MS = -4 * 60 * 60 * 1000;

/** ISO UTC → valor para <input type="datetime-local"> en hora de Santo Domingo. */
export function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** Día local (YYYY-MM-DD) de una fecha ISO. */
export function localDay(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Inicio del día local (YYYY-MM-DD) como ISO UTC. */
export function localDayStartIso(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Fecha no válida");
  return new Date(`${day}T00:00:00-04:00`).toISOString();
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Período contable actual YYYY-MM en Santo Domingo. */
export function currentPeriod(now = new Date()) {
  return localDay(now).slice(0, 7);
}
