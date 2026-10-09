import { z } from "zod";
import { FEATURES, PROPERTY_TYPES } from "./definitions";

export const PAGE_SIZE = 12;

const optNum = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(/[,\s]/g, ""))),
  z.number().finite().nonnegative().optional(),
);
const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : undefined), z.string().optional());

export const searchSchema = z.object({
  q: optStr(80),
  provincia: optStr(80),
  municipio: optStr(80),
  sector: optStr(120),
  tipo: z.preprocess((v) => (v === "" ? undefined : v), z.enum(Object.keys(PROPERTY_TYPES) as [string, ...string[]]).optional()),
  moneda: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["DOP", "USD"]).optional()),
  min: optNum,
  max: optNum,
  hab: optNum,
  banos: optNum,
  parqueos: optNum,
  m2: optNum,
  car: z.preprocess(
    (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(",") : []),
    z.array(z.string()).transform((a) => a.filter((k) => k in FEATURES).slice(0, 10)),
  ),
  orden: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["recientes", "precio_asc", "precio_desc"]).default("recientes")),
  vista: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["tarjetas", "lista", "mapa"]).default("tarjetas")),
  pagina: z.preprocess((v) => (v ? Number(v) : 1), z.number().int().min(1).max(500).default(1)),
});

export type SearchFilters = z.infer<typeof searchSchema>;

export function parseSearch(params: Record<string, string | string[] | undefined>): SearchFilters {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = k === "car" ? v : Array.isArray(v) ? v[0] : v;
  const r = searchSchema.safeParse(flat);
  return r.success ? r.data : searchSchema.parse({});
}

/** Serializa filtros a querystring (para mantenerlos al volver de la ficha y en la paginación). */
export function toQueryString(f: Partial<SearchFilters>, overrides: Partial<SearchFilters> = {}) {
  const merged = { ...f, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "orden" && v === "recientes") continue;
    if (k === "vista" && v === "tarjetas") continue;
    if (k === "pagina" && v === 1) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function activeFilterCount(f: SearchFilters) {
  return ["q", "provincia", "municipio", "sector", "tipo", "moneda", "min", "max", "hab", "banos", "parqueos", "m2"].filter(
    (k) => f[k as keyof SearchFilters] !== undefined,
  ).length + f.car.length;
}
