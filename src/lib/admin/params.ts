// Utilidades para filtros, búsqueda, orden y paginación mediante searchParams.

export type SP = Record<string, string | string[] | undefined>;

export function str(sp: SP, key: string, max = 120): string {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? "").trim().slice(0, max);
}

/** Valor permitido de una lista (o cadena vacía). */
export function oneOf<T extends string>(sp: SP, key: string, allowed: readonly T[]): T | "" {
  const s = str(sp, key);
  return (allowed as readonly string[]).includes(s) ? (s as T) : "";
}

export function pageOf(sp: SP, pageSize = 25) {
  const n = Number.parseInt(str(sp, "pagina"), 10);
  const page = Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

/** Orden "campo" o "-campo" restringido a columnas permitidas. */
export function sortOf<T extends string>(sp: SP, allowed: readonly T[], fallback: T, fallbackDesc = true) {
  const raw = str(sp, "orden");
  const desc = raw.startsWith("-");
  const col = (desc ? raw.slice(1) : raw) as T;
  if (raw && allowed.includes(col)) return { column: col, ascending: !desc, raw };
  return { column: fallback, ascending: !fallbackDesc, raw: `${fallbackDesc ? "-" : ""}${fallback}` };
}

/** Construye un enlace conservando filtros, con cambios puntuales (undefined/"" elimina la clave). */
export function hrefWith(base: string, sp: SP, changes: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** Escapa comodines para búsquedas ilike de PostgREST (y caracteres que rompen el filtro or()). */
export function ilikeTerm(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/[,()*]/g, " ").trim();
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);
