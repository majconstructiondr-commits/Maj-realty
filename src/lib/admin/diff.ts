// Diferencias legibles entre una solicitud de cambio (property_change_requests.changes)
// y los valores vigentes de la publicación. Solo informa: la aplicación ocurre en review_property_change.
import { CONDITIONS, FEATURES, NUMERIC_FIELDS, OPERATIONS, PROPERTY_TYPES, SPACE_FIELDS, TRI } from "@/lib/catalog/definitions";

type Dict = Record<string, unknown>;
export type PriceRow = Dict & { operation?: string };
export type ChangeSet = { property?: Dict; private?: Dict; prices?: PriceRow[] };
export type Current = { property: Dict; private: Dict | null; prices: PriceRow[] };
export type DiffRow = {
  section: "Inmueble" | "Datos privados" | "Precios";
  field: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
  /** false si review_property_change no aplica este campo */
  applied: boolean;
};

// Deben coincidir con las listas permitidas de review_property_change.
export const ALLOWED_PROPERTY = [
  "title", "operation", "property_type", "description", "condition", "province", "municipality", "sector",
  "exact_address_public", "public_address", "built_area_m2", "land_area_m2", "bedrooms", "bathrooms", "half_bathrooms",
  "parking_spaces", "floor_number", "levels", "year_built", "service_room", "service_bathroom", "laundry_area", "balcony",
  "terrace", "patio", "roof_area", "roof_use_detail", "na_fields", "features", "condo_rules", "restrictions",
];
export const ALLOWED_PRIVATE = [
  "street", "street_number", "building", "unit", "exact_lat", "exact_lng", "owner_name", "owner_phone", "owner_email",
  "owner_id_type", "owner_id_number", "publisher_relationship", "publication_authorized", "authorization_date",
  "authorization_expires", "commission_terms", "exclusivity", "exclusivity_expires", "title_type", "title_registry_number",
  "cadastral_designation", "survey_status", "legal_status_certificate_date", "declared_liens", "tax_notes", "contract_notes",
];

export const FIELD_LABELS: Record<string, string> = {
  title: "Título", operation: "Operación", property_type: "Tipo", description: "Descripción", condition: "Condición",
  province: "Provincia", municipality: "Municipio", sector: "Sector", exact_address_public: "Dirección exacta pública",
  public_address: "Dirección pública", roof_use_detail: "Uso del techo", na_fields: "Campos que no aplican",
  features: "Características", condo_rules: "Reglas del condominio", restrictions: "Restricciones",
  street: "Calle", street_number: "Número", building: "Edificio", unit: "Unidad", exact_lat: "Latitud exacta",
  exact_lng: "Longitud exacta", owner_name: "Nombre del propietario", owner_phone: "Teléfono del propietario",
  owner_email: "Correo del propietario", owner_id_type: "Tipo de documento", owner_id_number: "Número de documento",
  publisher_relationship: "Relación del publicador", publication_authorized: "Publicación autorizada",
  authorization_date: "Fecha de autorización", authorization_expires: "Vencimiento de autorización",
  commission_terms: "Términos de comisión", exclusivity: "Exclusividad", exclusivity_expires: "Vencimiento de exclusividad",
  title_type: "Tipo de título", title_registry_number: "Matrícula", cadastral_designation: "Designación catastral",
  survey_status: "Deslinde", legal_status_certificate_date: "Fecha de certificación jurídica", declared_liens: "Gravámenes declarados",
  tax_notes: "Notas de impuestos", contract_notes: "Notas de contrato",
  amount: "Precio", currency: "Moneda", negotiable: "Negociable", maintenance_amount: "Mantenimiento",
  maintenance_currency: "Moneda del mantenimiento", maintenance_included: "Mantenimiento incluido", additional_costs: "Costos adicionales",
  rent_period: "Período de renta", deposit_amount: "Depósito", deposit_months: "Meses de depósito", advance_months: "Meses de adelanto",
  min_term_months: "Plazo mínimo (meses)", delivery_conditions: "Condiciones de entrega",
  ...Object.fromEntries(Object.entries(NUMERIC_FIELDS).map(([k, v]) => [k, v.label])),
  ...SPACE_FIELDS,
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  operation: OPERATIONS, property_type: PROPERTY_TYPES, condition: CONDITIONS,
  ...Object.fromEntries(Object.keys(SPACE_FIELDS).map((k) => [k, TRI])),
  maintenance_included: TRI,
};

const PRICE_FIELDS = [
  "amount", "currency", "negotiable", "maintenance_amount", "maintenance_currency", "maintenance_included", "additional_costs",
  "rent_period", "deposit_amount", "deposit_months", "advance_months", "min_term_months", "delivery_conditions",
];

// Valores por defecto que review_property_change usa al reemplazar un precio.
const PRICE_DEFAULTS: Record<string, unknown> = { negotiable: false, maintenance_included: "desconocido" };

export function displayValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.length ? v.map((x) => FIELD_LABELS[String(x)] ?? String(x)).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return VALUE_LABELS[field]?.[s] ?? s;
}

function same(a: unknown, b: unknown) {
  const norm = (x: unknown) => (x === "" || x === undefined ? null : typeof x === "number" ? String(x) : x);
  const na = norm(a);
  const nb = norm(b);
  if (typeof na === "string" && typeof nb === "string" && na.trim() !== "" && Number.isFinite(Number(na)) && Number.isFinite(Number(nb))) {
    return Number(na) === Number(nb);
  }
  return JSON.stringify(na) === JSON.stringify(nb);
}

function featureRows(before: unknown, after: unknown): DiffRow[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, { v?: string; d?: string }>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, { v?: string; d?: string }>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
  const show = (x?: { v?: string; d?: string }) =>
    x ? `${TRI[x.v as keyof typeof TRI] ?? x.v ?? "—"}${x.d ? ` (${x.d})` : ""}` : "—";
  return keys.map((k) => ({
    section: "Inmueble" as const,
    field: `features.${k}`,
    label: `Característica: ${FEATURES[k]?.label ?? k}`,
    before: show(b[k]),
    after: show(a[k]),
    changed: show(b[k]) !== show(a[k]),
    applied: true,
  }));
}

/** Construye las filas de diferencias. Por defecto devuelve solo las que cambian. */
export function buildChangeDiff(changes: ChangeSet, current: Current, opts: { onlyChanged?: boolean } = {}): DiffRow[] {
  const onlyChanged = opts.onlyChanged ?? true;
  const rows: DiffRow[] = [];

  for (const [field, after] of Object.entries(changes.property ?? {})) {
    if (field === "features") {
      rows.push(...featureRows(current.property.features, after));
      continue;
    }
    const before = current.property[field];
    rows.push({
      section: "Inmueble", field, label: FIELD_LABELS[field] ?? field,
      before: displayValue(field, before), after: displayValue(field, after),
      changed: !same(before, after), applied: ALLOWED_PROPERTY.includes(field),
    });
  }

  for (const [field, after] of Object.entries(changes.private ?? {})) {
    const before = current.private?.[field];
    rows.push({
      section: "Datos privados", field, label: FIELD_LABELS[field] ?? field,
      before: displayValue(field, before), after: displayValue(field, after),
      changed: !same(before, after), applied: ALLOWED_PRIVATE.includes(field),
    });
  }

  if (Array.isArray(changes.prices)) {
    const ops = [...new Set([...current.prices.map((p) => String(p.operation)), ...changes.prices.map((p) => String(p.operation))])];
    for (const op of ops) {
      const b = current.prices.find((p) => p.operation === op);
      const a = changes.prices.find((p) => p.operation === op);
      const opLabel = op === "venta" ? "Venta" : op === "renta" ? "Renta" : op;
      if (!a) {
        rows.push({ section: "Precios", field: `${op}`, label: `${opLabel}: precio`, before: displayValue("amount", b?.amount), after: "Se elimina", changed: true, applied: true });
        continue;
      }
      for (const f of PRICE_FIELDS) {
        // un precio nuevo reemplaza la fila completa: los campos ausentes quedan vacíos
        const before = b?.[f];
        const after = a[f] ?? PRICE_DEFAULTS[f];
        rows.push({
          section: "Precios", field: `${op}.${f}`, label: `${opLabel}: ${FIELD_LABELS[f] ?? f}`,
          before: displayValue(f, before), after: displayValue(f, after), changed: !same(before, after), applied: true,
        });
      }
    }
  }

  return onlyChanged ? rows.filter((r) => r.changed) : rows;
}
