// Búsquedas guardadas: se guarda la operación y la cadena de consulta del catálogo (/venta?… o /renta?…).

export type SavedSearchQuery = { operation: "venta" | "renta"; qs: string };

const ALLOWED_KEYS = new Set(["q", "provincia", "municipio", "sector", "tipo", "moneda", "min", "max", "hab", "banos", "parqueos", "m2", "car", "orden", "vista"]);

/** Interpreta una ruta del catálogo ("/venta?tipo=casa") y devuelve solo parámetros de búsqueda conocidos. */
export function parseCatalogPath(path: unknown): SavedSearchQuery | null {
  if (typeof path !== "string" || path.length > 1000) return null;
  const m = /^\/(venta|renta)(?:\?(.*))?$/.exec(path.trim());
  if (!m) return null;
  const sp = new URLSearchParams(m[2] ?? "");
  const out = new URLSearchParams();
  for (const [k, v] of sp) {
    if (!ALLOWED_KEYS.has(k) || out.has(k)) continue;
    const val = v.trim().slice(0, 120);
    if (val) out.set(k, val);
  }
  out.sort();
  return { operation: m[1] as "venta" | "renta", qs: out.toString() };
}

/** Enlace al catálogo a partir de la consulta guardada. */
export function savedSearchHref(query: unknown): string | null {
  if (!query || typeof query !== "object") return null;
  const q = query as Partial<SavedSearchQuery>;
  if (q.operation !== "venta" && q.operation !== "renta") return null;
  const parsed = parseCatalogPath(`/${q.operation}${q.qs ? `?${q.qs}` : ""}`);
  if (!parsed) return null;
  return `/${parsed.operation}${parsed.qs ? `?${parsed.qs}` : ""}`;
}

const LABELS: Record<string, string> = {
  q: "Texto", provincia: "Provincia", municipio: "Municipio", sector: "Sector", tipo: "Tipo", moneda: "Moneda",
  min: "Mínimo", max: "Máximo", hab: "Habitaciones", banos: "Baños", parqueos: "Parqueos", m2: "m² mín.", car: "Características",
};

/** Resumen corto para mostrar en la lista ("Tipo: casa · Provincia: Santiago"). */
export function describeSavedSearch(query: SavedSearchQuery): string {
  const sp = new URLSearchParams(query.qs);
  const parts: string[] = [];
  for (const [k, v] of sp) if (LABELS[k]) parts.push(`${LABELS[k]}: ${v}`);
  return parts.length ? parts.join(" · ") : "Todos los inmuebles";
}
