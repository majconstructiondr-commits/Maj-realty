// Horarios de citas configurados en site_settings "appointments.hours": {"1": ["09:00","17:00"], ...} (0 = domingo).
// Todas las horas son de Santo Domingo (UTC-4, sin horario de verano).

export type BusinessHours = Record<string, [string, string] | string[] | undefined>;

export const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Día de la semana (0 = domingo) de una fecha "YYYY-MM-DD" del calendario local. */
export function weekdayOf(date: string): number | null {
  if (!DATE_RE.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  return d.getUTCDay();
}

function toMinutes(t: string): number | null {
  const m = TIME_RE.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fromMinutes(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

/** Horario de atención de un día de la semana o null si no se atiende. */
export function hoursForWeekday(hours: BusinessHours, weekday: number): [string, string] | null {
  const v = hours[String(weekday)];
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [a, b] = v;
  const s = toMinutes(String(a));
  const e = toMinutes(String(b));
  if (s === null || e === null || e <= s) return null;
  return [String(a), String(b)];
}

/**
 * Horas de inicio posibles para una fecha: la cita completa (duración) debe caber dentro del horario.
 * Ej.: 09:00–13:00 con 60 min y pasos de 30 → 09:00, 09:30, …, 12:00.
 */
export function timeSlots(hours: BusinessHours, date: string, durationMinutes: number, stepMinutes = 30): string[] {
  const wd = weekdayOf(date);
  if (wd === null || durationMinutes <= 0 || stepMinutes <= 0) return [];
  const h = hoursForWeekday(hours, wd);
  if (!h) return [];
  const start = toMinutes(h[0])!;
  const end = toMinutes(h[1])!;
  const out: string[] = [];
  for (let t = start; t + durationMinutes <= end; t += stepMinutes) out.push(fromMinutes(t));
  return out;
}

/** Texto legible del horario semanal, empezando por el lunes. */
export function describeHours(hours: BusinessHours): { day: string; hours: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const h = hoursForWeekday(hours, wd);
    return { day: WEEKDAYS[wd], hours: h ? `${h[0]} – ${h[1]}` : "Cerrado" };
  });
}

/** ¿La hora elegida está entre las permitidas para la fecha? */
export function isValidSlot(hours: BusinessHours, date: string, time: string, durationMinutes: number) {
  return timeSlots(hours, date, durationMinutes, 1).includes(time);
}

/** Fecha local (Santo Domingo) "YYYY-MM-DD" de un instante. */
export function localDate(d: Date): string {
  return new Date(d.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Rango de fechas reservables (Santo Domingo): desde ahora + anticipación mínima hasta 89 días. */
export function bookingWindow(leadHours: number, now: Date = new Date()) {
  const t = now.getTime();
  return {
    nowMs: t,
    minDate: localDate(new Date(t + leadHours * 3600 * 1000)),
    maxDate: localDate(new Date(t + 89 * 24 * 3600 * 1000)),
  };
}
