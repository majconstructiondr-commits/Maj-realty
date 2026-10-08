// Validación por paso del editor de publicaciones (servidor y pruebas unitarias).
// Sin dependencias de servidor: se puede importar desde pruebas y componentes.
import { z } from "zod";
import {
  CONDITIONS, FEATURES, NUMERIC_FIELDS, PROPERTY_TYPES, PROVINCES, SPACE_FIELDS, TRI, fieldApplies,
  type NumericField, type PropertyType, type SpaceField, type Tri,
} from "@/lib/catalog/definitions";

// ---------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------
export const STEPS = [
  { n: 1, key: "basicos", label: "Datos básicos" },
  { n: 2, key: "ubicacion", label: "Ubicación" },
  { n: 3, key: "precios", label: "Precios" },
  { n: 4, key: "distribucion", label: "Distribución" },
  { n: 5, key: "caracteristicas", label: "Características" },
  { n: 6, key: "multimedia", label: "Multimedia" },
  { n: 7, key: "privados", label: "Datos privados y documentos" },
  { n: 8, key: "envio", label: "Vista previa y envío" },
] as const;
export type StepNumber = (typeof STEPS)[number]["n"];

/** Interpreta ?paso=… (número o clave). Por defecto, paso 1. */
export function parseStep(v: unknown): StepNumber {
  const s = Array.isArray(v) ? v[0] : v;
  const byKey = STEPS.find((x) => x.key === s);
  if (byKey) return byKey.n;
  const n = Number(s);
  return (Number.isInteger(n) && n >= 1 && n <= STEPS.length ? n : 1) as StepNumber;
}

/** Estados en los que el titular edita directamente; en los demás, los cambios van como solicitud. */
export const DIRECT_EDIT_STATUSES = ["borrador", "rechazado"] as const;
export const isLiveStatus = (status: string) => !(DIRECT_EDIT_STATUSES as readonly string[]).includes(status);

// ---------------------------------------------------------------------
// Utilidades de formularios
// ---------------------------------------------------------------------
const blankToNull = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v);
const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === "1" || v === true, z.boolean());

export function optText(max: number, label = "Este campo") {
  return z.preprocess(
    (v) => {
      const b = blankToNull(v);
      return typeof b === "string" ? b.trim() : b;
    },
    z.string().max(max, `${label} admite como máximo ${max} caracteres`).nullable(),
  );
}

/** Número opcional: vacío = null; acepta separadores de miles con coma. */
export function optNumber(min: number, max: number, opts: { int?: boolean; label?: string } = {}) {
  const label = opts.label ?? "El valor";
  let n = z.number({ error: `${label} debe ser un número` }).min(min, `${label} no puede ser menor que ${min}`).max(max, `${label} no puede ser mayor que ${max}`);
  if (opts.int) n = n.int(`${label} debe ser un número entero`);
  return z.preprocess((v) => {
    const b = blankToNull(v);
    if (b === null) return null;
    if (typeof b === "number") return b;
    const num = Number(String(b).replace(/[,\s]/g, ""));
    return Number.isFinite(num) ? num : String(b);
  }, n.nullable());
}

export const optDate = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (AAAA-MM-DD)").nullable(),
);

export const optEmail = z.preprocess(blankToNull, z.email("Correo no válido").max(160).nullable());

function optEnum<T extends string>(values: readonly [T, ...T[]], msg = "Opción no válida") {
  return z.preprocess(blankToNull, z.enum(values, { error: msg }).nullable());
}

export const triSchema = z.enum(keys(TRI), { error: "Elija Sí, No, Desconocido o No aplica" });
export const currencySchema = z.enum(["DOP", "USD"], { error: "Seleccione la moneda" });

/** Primer mensaje de error por campo (clave = nombre del campo del formulario). */
export function zodFieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

// ---------------------------------------------------------------------
// Paso 1: datos básicos
// ---------------------------------------------------------------------
export const basicSchema = z.object({
  title: z.string({ error: "Indique un título" }).trim().min(5, "El título debe tener al menos 5 caracteres").max(140, "El título admite como máximo 140 caracteres"),
  operation: z.enum(["venta", "renta", "ambas"], { error: "Seleccione la operación" }),
  property_type: z.enum(keys(PROPERTY_TYPES), { error: "Seleccione el tipo de inmueble" }),
  condition: optEnum(keys(CONDITIONS), "Seleccione una condición válida"),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(8000, "La descripción admite como máximo 8000 caracteres")),
  available_from: optDate,
});
export type BasicData = z.infer<typeof basicSchema>;

/** Esquema mínimo para crear un borrador nuevo. */
export const newDraftSchema = z.object({
  title: basicSchema.shape.title,
  operation: basicSchema.shape.operation,
  property_type: basicSchema.shape.property_type,
  organization_id: z.preprocess(blankToNull, z.uuid("Organización no válida").nullable()),
});

export const operationsFor = (op: "venta" | "renta" | "ambas"): ("venta" | "renta")[] =>
  op === "ambas" ? ["venta", "renta"] : [op];

// ---------------------------------------------------------------------
// Paso 2: ubicación
// ---------------------------------------------------------------------
export const locationSchema = z
  .object({
    province: z.preprocess((v) => (typeof v === "string" ? v : ""), z.union([z.enum(PROVINCES), z.literal("")], { error: "Seleccione una provincia de la lista" })),
    municipality: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(80, "Máximo 80 caracteres")),
    sector: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(120, "Máximo 120 caracteres")),
    street: optText(160, "La calle"),
    street_number: optText(30, "El número"),
    building: optText(120, "El edificio"),
    unit: optText(40, "La unidad"),
    exact_lat: optNumber(-90, 90, { label: "La latitud" }),
    exact_lng: optNumber(-180, 180, { label: "La longitud" }),
    exact_address_public: checkbox,
    owner_authorized_address: checkbox,
    public_address: optText(300, "La dirección pública"),
  })
  .superRefine((d, ctx) => {
    if ((d.exact_lat === null) !== (d.exact_lng === null)) {
      ctx.addIssue({ code: "custom", path: [d.exact_lat === null ? "exact_lat" : "exact_lng"], message: "Indique latitud y longitud juntas, o deje ambas vacías" });
    }
    if (d.exact_address_public) {
      if (!d.owner_authorized_address) {
        ctx.addIssue({ code: "custom", path: ["owner_authorized_address"], message: "Confirme que el propietario autorizó mostrar la dirección exacta" });
      }
      if (!d.public_address) {
        ctx.addIssue({ code: "custom", path: ["public_address"], message: "Escriba la dirección que se mostrará públicamente" });
      }
    }
  })
  .transform((d) => ({
    property: {
      province: d.province,
      municipality: d.municipality,
      sector: d.sector,
      exact_address_public: d.exact_address_public,
      public_address: d.exact_address_public ? d.public_address : null,
    },
    private: {
      street: d.street,
      street_number: d.street_number,
      building: d.building,
      unit: d.unit,
      exact_lat: d.exact_lat,
      exact_lng: d.exact_lng,
    },
  }));

// ---------------------------------------------------------------------
// Paso 3: precios (un bloque por operación; campos con prefijo "venta_" o "renta_")
// ---------------------------------------------------------------------
export const PRICE_FIELDS = [
  "amount", "currency", "negotiable", "maintenance_amount", "maintenance_currency", "maintenance_included",
  "additional_costs", "rent_period", "deposit_amount", "deposit_months", "advance_months", "min_term_months",
  "delivery_conditions",
] as const;

const priceBlockSchema = z.object({
  amount: optNumber(0, 99999999999999, { label: "El precio" }),
  currency: currencySchema,
  negotiable: checkbox,
  maintenance_amount: optNumber(0, 999999999999, { label: "El mantenimiento" }),
  maintenance_currency: optEnum(["DOP", "USD"] as const),
  maintenance_included: z.preprocess((v) => blankToNull(v) ?? "desconocido", triSchema),
  additional_costs: optText(1000, "Gastos adicionales"),
  rent_period: optEnum(["mensual", "diario", "semanal", "anual"] as const, "Seleccione el período de renta"),
  deposit_amount: optNumber(0, 999999999999, { label: "El depósito" }),
  deposit_months: optNumber(0, 999.9, { label: "Los meses de depósito" }),
  advance_months: optNumber(0, 999.9, { label: "Los meses de adelanto" }),
  min_term_months: optNumber(0, 32767, { int: true, label: "El plazo mínimo" }),
  delivery_conditions: optText(1000, "Condiciones de entrega"),
});

export type PriceRow = {
  operation: "venta" | "renta";
  amount: number | null;
  currency: "DOP" | "USD";
  negotiable: boolean;
  maintenance_amount: number | null;
  maintenance_currency: "DOP" | "USD" | null;
  maintenance_included: Tri;
  additional_costs: string | null;
  rent_period: "mensual" | "diario" | "semanal" | "anual" | null;
  deposit_amount: number | null;
  deposit_months: number | null;
  advance_months: number | null;
  min_term_months: number | null;
  delivery_conditions: string | null;
};

/** Lee los bloques de precio de las operaciones aplicables. Importe vacío = "precio a consultar". */
export function parsePrices(raw: Record<string, unknown>, operation: "venta" | "renta" | "ambas"):
  { ok: true; rows: PriceRow[] } | { ok: false; errors: Record<string, string> } {
  const rows: PriceRow[] = [];
  const errors: Record<string, string> = {};
  for (const op of operationsFor(operation)) {
    const block: Record<string, unknown> = {};
    for (const f of PRICE_FIELDS) block[f] = raw[`${op}_${f}`];
    const r = priceBlockSchema.safeParse(block);
    if (!r.success) {
      for (const i of r.error.issues) {
        const k = `${op}_${String(i.path[0] ?? "amount")}`;
        if (!errors[k]) errors[k] = i.message;
      }
      continue;
    }
    const d = r.data;
    const isRent = op === "renta";
    rows.push({
      operation: op,
      amount: d.amount,
      currency: d.currency,
      negotiable: d.negotiable,
      maintenance_amount: d.maintenance_amount,
      maintenance_currency: d.maintenance_amount !== null ? d.maintenance_currency ?? d.currency : d.maintenance_currency,
      maintenance_included: d.maintenance_included,
      additional_costs: d.additional_costs,
      rent_period: isRent ? d.rent_period ?? "mensual" : null,
      deposit_amount: isRent ? d.deposit_amount : null,
      deposit_months: isRent ? d.deposit_months : null,
      advance_months: isRent ? d.advance_months : null,
      min_term_months: isRent ? d.min_term_months : null,
      delivery_conditions: d.delivery_conditions,
    });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, rows };
}

// ---------------------------------------------------------------------
// Paso 4: distribución. Cada campo numérico tiene una elección explícita:
//   valor (0 permitido) → columna = número
//   desconocido         → columna = NULL, fuera de na_fields
//   no aplica           → columna = NULL, dentro de na_fields
// ---------------------------------------------------------------------
export const NUMERIC_MODES = { valor: "Valor", desconocido: "Desconocido", no_aplica: "No aplica" } as const;
export type NumericMode = keyof typeof NUMERIC_MODES;

export const NUMERIC_LIMITS: Record<NumericField, { min: number; max: number; int: boolean }> = {
  built_area_m2: { min: 0, max: 9999999999, int: false },
  land_area_m2: { min: 0, max: 999999999999, int: false },
  bedrooms: { min: 0, max: 200, int: true },
  bathrooms: { min: 0, max: 200, int: true },
  half_bathrooms: { min: 0, max: 200, int: true },
  parking_spaces: { min: 0, max: 2000, int: true },
  floor_number: { min: -10, max: 200, int: true },
  levels: { min: 0, max: 200, int: true },
  year_built: { min: 1800, max: 2100, int: true },
};

export const numericFieldKeys = Object.keys(NUMERIC_FIELDS) as NumericField[];
export const spaceFieldKeys = Object.keys(SPACE_FIELDS) as SpaceField[];

/** Modo inicial de un campo numérico a partir de lo guardado (y del tipo, si nunca se indicó). */
export function initialNumericMode(
  field: NumericField,
  value: number | string | null | undefined,
  naFields: readonly string[],
  type: PropertyType,
): NumericMode {
  if (naFields.includes(field)) return "no_aplica";
  if (value !== null && value !== undefined && value !== "") return "valor";
  return fieldApplies(type, field) ? "desconocido" : "no_aplica";
}

/** Valor inicial de un espacio (tri-estado): si no aplica por tipo y está "desconocido", se pre-marca "no aplica". */
export function initialSpaceValue(field: SpaceField, value: Tri | null | undefined, type: PropertyType): Tri {
  const v = value ?? "desconocido";
  return v === "desconocido" && !fieldApplies(type, field) ? "no_aplica" : v;
}

export type DistributionData = Record<NumericField, number | null> &
  Record<SpaceField, Tri> & { na_fields: string[]; roof_use_detail: string | null };

/** Convierte el formulario de distribución en columnas + na_fields. Nombres: `<campo>__modo`, `<campo>`. */
export function parseDistribution(raw: Record<string, unknown>):
  { ok: true; data: DistributionData } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const out: Record<string, unknown> = {};
  const na: string[] = [];
  for (const f of numericFieldKeys) {
    const label = NUMERIC_FIELDS[f].label;
    const mode = raw[`${f}__modo`] ?? "desconocido";
    if (mode !== "valor" && mode !== "desconocido" && mode !== "no_aplica") {
      errors[f] = `${label}: elija Valor, Desconocido o No aplica`;
      continue;
    }
    if (mode === "no_aplica") {
      na.push(f);
      out[f] = null;
      continue;
    }
    if (mode === "desconocido") {
      out[f] = null;
      continue;
    }
    const lim = NUMERIC_LIMITS[f];
    const r = optNumber(lim.min, lim.max, { int: lim.int, label }).safeParse(raw[f]);
    if (!r.success) {
      errors[f] = r.error.issues[0]?.message ?? `${label}: valor no válido`;
    } else if (r.data === null) {
      errors[f] = `${label}: escriba el valor (0 es válido) o elija Desconocido / No aplica`;
    } else {
      out[f] = r.data;
    }
  }
  for (const s of spaceFieldKeys) {
    const r = triSchema.safeParse(raw[s] ?? "desconocido");
    if (!r.success) errors[s] = `${SPACE_FIELDS[s]}: opción no válida`;
    else out[s] = r.data;
  }
  const roof = optText(500, "El uso del techo").safeParse(raw.roof_use_detail);
  if (!roof.success) errors.roof_use_detail = roof.error.issues[0]?.message ?? "Texto no válido";
  else out.roof_use_detail = roof.data;
  if (Object.keys(errors).length) return { ok: false, errors };
  out.na_fields = na;
  return { ok: true, data: out as DistributionData };
}

// ---------------------------------------------------------------------
// Paso 5: características (tri-estado + detalle opcional)
// ---------------------------------------------------------------------
export type FeatureMap = Record<string, { v: Tri; d?: string }>;
export const featureKeys = Object.keys(FEATURES);

/** "desconocido" sin detalle no se guarda (equivale a no indicar nada). */
export function parseFeatures(raw: Record<string, unknown>):
  { ok: true; data: { features: FeatureMap; condo_rules: string | null; restrictions: string | null } } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const features: FeatureMap = {};
  for (const k of featureKeys) {
    const v = triSchema.safeParse(raw[`feat_${k}`] ?? "desconocido");
    const d = optText(200, "El detalle").safeParse(raw[`feat_${k}_detalle`]);
    if (!v.success) {
      errors[`feat_${k}`] = `${FEATURES[k].label}: opción no válida`;
      continue;
    }
    if (!d.success) {
      errors[`feat_${k}_detalle`] = d.error.issues[0]?.message ?? "Detalle no válido";
      continue;
    }
    if (v.data === "desconocido" && !d.data) continue;
    features[k] = d.data ? { v: v.data, d: d.data } : { v: v.data };
  }
  const rest = z.object({ condo_rules: optText(3000, "Las reglas"), restrictions: optText(2000, "Las restricciones") }).safeParse(raw);
  if (!rest.success) Object.assign(errors, zodFieldErrors(rest.error));
  if (Object.keys(errors).length || !rest.success) return { ok: false, errors };
  return { ok: true, data: { features, ...rest.data } };
}

// ---------------------------------------------------------------------
// Paso 7: datos privados (información declarada por el vendedor, no verificada por MAJ)
// ---------------------------------------------------------------------
export const ID_TYPES = { cedula: "Cédula", pasaporte: "Pasaporte", rnc: "RNC", otro: "Otro" } as const;
export const RELATIONSHIPS = { propietario: "Soy el propietario", representante: "Representante (poder)", agente: "Agente inmobiliario", otro: "Otro" } as const;
export const SURVEY_STATUSES = { deslindado: "Deslindado", no_deslindado: "No deslindado", en_proceso: "En proceso", desconocido: "Desconocido", no_aplica: "No aplica" } as const;
export const DOC_TYPES_LABELS = {
  autorizacion_publicacion: "Autorización de publicación",
  identificacion_propietario: "Identificación del propietario",
  titulo: "Certificado de título",
  certificacion_estado_juridico: "Certificación del estado jurídico",
  plano_catastral: "Plano catastral",
  deslinde: "Deslinde",
  impuestos: "Impuestos (IPI u otros)",
  contrato: "Contrato",
  poder_representacion: "Poder de representación",
  otro: "Otro",
} as const;
export type DocType = keyof typeof DOC_TYPES_LABELS;

export const privateSchema = z
  .object({
    owner_name: optText(160, "El nombre"),
    owner_phone: optText(40, "El teléfono"),
    owner_email: optEmail,
    owner_id_type: optEnum(keys(ID_TYPES)),
    owner_id_number: optText(40, "El número de documento"),
    publisher_relationship: optEnum(keys(RELATIONSHIPS)),
    publication_authorized: checkbox,
    authorization_date: optDate,
    authorization_expires: optDate,
    commission_terms: optText(1000, "Las condiciones de comisión"),
    exclusivity: z.preprocess((v) => (v === "si" ? true : v === "no" ? false : null), z.boolean().nullable()),
    exclusivity_expires: optDate,
    title_type: optText(120, "El tipo de título"),
    title_registry_number: optText(120, "La matrícula"),
    cadastral_designation: optText(160, "La designación catastral"),
    survey_status: optEnum(keys(SURVEY_STATUSES)),
    legal_status_certificate_date: optDate,
    declared_liens: optText(2000, "Las cargas declaradas"),
    tax_notes: optText(2000, "Las notas de impuestos"),
    contract_notes: optText(2000, "Las notas de contrato"),
  })
  .superRefine((d, ctx) => {
    if (d.publication_authorized && !d.authorization_date) {
      ctx.addIssue({ code: "custom", path: ["authorization_date"], message: "Indique la fecha de la autorización de publicación" });
    }
    if (d.authorization_date && d.authorization_expires && d.authorization_expires < d.authorization_date) {
      ctx.addIssue({ code: "custom", path: ["authorization_expires"], message: "El vencimiento no puede ser anterior a la fecha de autorización" });
    }
    if (d.exclusivity !== true && d.exclusivity_expires) {
      ctx.addIssue({ code: "custom", path: ["exclusivity_expires"], message: "Solo indique vencimiento si hay exclusividad" });
    }
  });
export type PrivateData = z.infer<typeof privateSchema>;

// ---------------------------------------------------------------------
// Requisitos para enviar a revisión (refleja public.assert_listing_complete)
// ---------------------------------------------------------------------
export type CompletenessInput = {
  province: string | null;
  municipality: string | null;
  description: string | null;
  operation: "venta" | "renta" | "ambas";
  priceOperations: string[];
  photoCount: number;
  publicationAuthorized: boolean;
};

export function missingForReview(p: CompletenessInput): string[] {
  const m: string[] = [];
  if (!p.province) m.push("provincia");
  if (!p.municipality) m.push("municipio");
  if ((p.description ?? "").length < 30) m.push("descripción (mínimo 30 caracteres)");
  if (p.operation !== "renta" && !p.priceOperations.includes("venta")) m.push("precio de venta");
  if (p.operation !== "venta" && !p.priceOperations.includes("renta")) m.push("precio de renta");
  if (p.photoCount < 1) m.push("al menos una foto");
  if (!p.publicationAuthorized) m.push("autorización de publicación");
  return m;
}

/** Paso del editor donde se completa cada requisito. */
export const MISSING_STEP: Record<string, StepNumber> = {
  provincia: 2,
  municipio: 2,
  "descripción (mínimo 30 caracteres)": 1,
  "precio de venta": 3,
  "precio de renta": 3,
  "al menos una foto": 6,
  "autorización de publicación": 7,
};

// ---------------------------------------------------------------------
// Solicitudes de cambio sobre publicaciones activas
// ---------------------------------------------------------------------
export type ChangeSet = { property?: Record<string, unknown>; prices?: PriceRow[]; private?: Record<string, unknown> };

/** Normaliza para comparar: números como número, arrays de texto ordenados, objetos con claves ordenadas. */
export function normalizeValue(v: unknown): unknown {
  if (v === undefined || v === "") return null;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (Array.isArray(v)) {
    const arr = v.map(normalizeValue);
    return arr.every((x) => typeof x === "string") ? [...(arr as string[])].sort() : arr;
  }
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, normalizeValue((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));

/**
 * Combina los cambios de una sección con la solicitud pendiente: solo se conservan los campos
 * que difieren de la versión publicada. Devuelve la sección resultante o undefined si queda vacía.
 */
export function mergeSection(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
  pending: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...(pending ?? {}) };
  for (const [k, v] of Object.entries(next)) {
    if (sameValue(current[k], v)) delete out[k];
    else out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const priceKey = (r: Record<string, unknown>) =>
  JSON.stringify(normalizeValue(Object.fromEntries(["operation", ...PRICE_FIELDS].map((k) => [k, r[k] ?? null]))));

export function samePrices(a: Record<string, unknown>[], b: Record<string, unknown>[]) {
  const ka = a.map(priceKey).sort();
  const kb = b.map(priceKey).sort();
  return ka.length === kb.length && ka.every((x, i) => x === kb[i]);
}

/** Construye la solicitud combinada; null si no queda ningún cambio respecto a lo publicado. */
export function buildChangeSet(
  pending: ChangeSet | null | undefined,
  update: {
    property?: { current: Record<string, unknown>; next: Record<string, unknown> };
    private?: { current: Record<string, unknown>; next: Record<string, unknown> };
    prices?: { current: Record<string, unknown>[]; next: PriceRow[] };
  },
): ChangeSet | null {
  const out: ChangeSet = {};
  const prop = update.property ? mergeSection(update.property.current, update.property.next, pending?.property) : pending?.property;
  const priv = update.private ? mergeSection(update.private.current, update.private.next, pending?.private) : pending?.private;
  if (prop && Object.keys(prop).length) out.property = prop;
  if (priv && Object.keys(priv).length) out.private = priv;
  if (update.prices) {
    if (!samePrices(update.prices.current, update.prices.next as unknown as Record<string, unknown>[])) out.prices = update.prices.next;
  } else if (pending?.prices) {
    out.prices = pending.prices;
  }
  return Object.keys(out).length ? out : null;
}
