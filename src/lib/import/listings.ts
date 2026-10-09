// Importación masiva de inmuebles desde Excel (.xlsx) o CSV.
// Código puro (sin acceso a red ni base de datos) para usarlo en el navegador, el servidor y las pruebas.
import { z } from "zod";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/catalog/definitions";

export const MAX_IMPORT_ROWS = 500;
export const MAX_PHOTOS_PER_ROW = 15;

/** Columnas de la plantilla, en orden. Las marcadas con * son obligatorias. */
export const IMPORT_COLUMNS = [
  ["referencia", "Código del inmueble en la otra empresa (evita duplicados)"],
  ["titulo", "* Título de la publicación (5 a 140 caracteres)"],
  ["operacion", "* venta, renta o ambas"],
  ["tipo", "* apartamento, casa, villa, solar, local, oficina, nave, finca, edificio o proyecto"],
  ["precio_venta", "Número, sin símbolos"],
  ["precio_renta", "Número mensual, sin símbolos"],
  ["moneda", "DOP o USD (obligatoria si hay precio)"],
  ["provincia", ""],
  ["municipio", ""],
  ["sector", ""],
  ["habitaciones", ""],
  ["banos", ""],
  ["medios_banos", ""],
  ["parqueos", ""],
  ["area_construida_m2", ""],
  ["area_terreno_m2", ""],
  ["descripcion", "Hasta 8000 caracteres"],
  ["fotos", "Enlaces https de las fotos separados por coma o espacio (JPG, PNG o WebP)"],
  ["video", "Enlace https de video o recorrido (opcional)"],
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number][0];

const HEADER_ALIASES: Record<string, ImportColumn> = {
  ref: "referencia", codigo: "referencia", id: "referencia",
  title: "titulo", nombre: "titulo",
  operation: "operacion",
  tipo_de_inmueble: "tipo", tipo_inmueble: "tipo", type: "tipo",
  precio: "precio_venta", precio_de_venta: "precio_venta", precio_alquiler: "precio_renta", precio_de_renta: "precio_renta", alquiler: "precio_renta",
  currency: "moneda", divisa: "moneda",
  ciudad: "municipio",
  habs: "habitaciones", dormitorios: "habitaciones", banos_completos: "banos", medio_bano: "medios_banos", parqueo: "parqueos", estacionamientos: "parqueos",
  area_construida: "area_construida_m2", construccion_m2: "area_construida_m2", m2_construccion: "area_construida_m2",
  area_terreno: "area_terreno_m2", terreno_m2: "area_terreno_m2", solar_m2: "area_terreno_m2",
  description: "descripcion", fotos_url: "fotos", imagenes: "fotos", photos: "fotos", video_url: "video", recorrido: "video",
};

export function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\*/g, "").trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function columnFor(h: unknown): ImportColumn | null {
  const n = normalizeHeader(h);
  if (IMPORT_COLUMNS.some(([c]) => c === n)) return n as ImportColumn;
  return HEADER_ALIASES[n] ?? null;
}

const OPERATION_ALIASES: Record<string, keyof typeof OPERATIONS> = {
  venta: "venta", vender: "venta", sale: "venta",
  renta: "renta", alquiler: "renta", alquilar: "renta", rent: "renta",
  ambas: "ambas", venta_y_renta: "ambas", venta_renta: "ambas", venta_alquiler: "ambas", venta_y_alquiler: "ambas",
};

const TYPE_ALIASES: Record<string, keyof typeof PROPERTY_TYPES> = {
  apto: "apartamento", apartamentos: "apartamento", penthouse: "apartamento", estudio: "apartamento",
  casas: "casa", villas: "villa", terreno: "solar", lote: "solar", solar_terreno: "solar",
  local_comercial: "local", oficinas: "oficina", nave_industrial: "nave", almacen: "nave", proyectos: "proyecto",
};

const CURRENCY_ALIASES: Record<string, "DOP" | "USD"> = {
  dop: "DOP", rd: "DOP", rd_: "DOP", pesos: "DOP", peso: "DOP",
  usd: "USD", us: "USD", us_: "USD", dolar: "USD", dolares: "USD",
};

/** "US$ 150,000.00" → 150000. Devuelve undefined si está vacío y NaN si no es un número. */
export function parseNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (!s) return Number.NaN;
  // 1.500.000,50 (formato europeo) frente a 1,500,000.50
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  return Number(s);
}

export function splitUrls(v: unknown): string[] {
  return String(v ?? "").split(/[\s,;|]+/).map((s) => s.trim()).filter(Boolean);
}

const httpsUrl = z.string().max(2000).url("Enlace no válido").refine((u) => u.startsWith("https://"), "El enlace debe empezar por https://");
const optInt = (max: number) => z.number().int("Debe ser un número entero").min(0, "No puede ser negativo").max(max).optional();
const optArea = z.number().min(0, "No puede ser negativo").max(1e9).optional();
const optPrice = z.number().min(0, "No puede ser negativo").max(1e13).optional();

export const importRowSchema = z.object({
  referencia: z.string().trim().max(80).optional(),
  titulo: z.string().trim().min(5, "El título debe tener al menos 5 caracteres").max(140, "Título muy largo (máx. 140)"),
  operacion: z.enum(Object.keys(OPERATIONS) as [keyof typeof OPERATIONS], { error: "Operación no válida (venta, renta o ambas)" }),
  tipo: z.enum(Object.keys(PROPERTY_TYPES) as [keyof typeof PROPERTY_TYPES], { error: "Tipo no válido" }),
  precio_venta: optPrice,
  precio_renta: optPrice,
  moneda: z.enum(["DOP", "USD"], { error: "Moneda no válida (DOP o USD)" }).optional(),
  provincia: z.string().trim().max(80).optional(),
  municipio: z.string().trim().max(80).optional(),
  sector: z.string().trim().max(120).optional(),
  habitaciones: optInt(200),
  banos: optInt(200),
  medios_banos: optInt(200),
  parqueos: optInt(2000),
  area_construida_m2: optArea,
  area_terreno_m2: optArea,
  descripcion: z.string().trim().max(8000, "Descripción muy larga (máx. 8000)").optional(),
  fotos: z.array(httpsUrl).max(MAX_PHOTOS_PER_ROW, `Máximo ${MAX_PHOTOS_PER_ROW} fotos por inmueble`).default([]),
  video: httpsUrl.optional(),
}).superRefine((d, ctx) => {
  if ((d.precio_venta !== undefined || d.precio_renta !== undefined) && !d.moneda) {
    ctx.addIssue({ code: "custom", path: ["moneda"], message: "Indique la moneda del precio (DOP o USD)" });
  }
  if (d.precio_venta !== undefined && d.operacion === "renta") {
    ctx.addIssue({ code: "custom", path: ["precio_venta"], message: "Tiene precio de venta pero la operación es renta" });
  }
  if (d.precio_renta !== undefined && d.operacion === "venta") {
    ctx.addIssue({ code: "custom", path: ["precio_renta"], message: "Tiene precio de renta pero la operación es venta" });
  }
});

export type ImportRow = z.output<typeof importRowSchema>;
export type ParsedImportRow = { line: number; data?: ImportRow; errors: string[]; title: string };

function cellText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
  return s === "" ? undefined : s;
}

function rawToCandidate(raw: Partial<Record<ImportColumn, unknown>>) {
  const key = (v: unknown) => normalizeHeader(v);
  const op = cellText(raw.operacion);
  const tipo = cellText(raw.tipo);
  const moneda = cellText(raw.moneda);
  const num = (c: ImportColumn) => parseNumber(cellText(raw[c]) === undefined ? undefined : raw[c]);
  return {
    referencia: cellText(raw.referencia),
    titulo: cellText(raw.titulo) ?? "",
    operacion: op ? (OPERATION_ALIASES[key(op)] ?? key(op)) : undefined,
    tipo: tipo ? (TYPE_ALIASES[key(tipo)] ?? key(tipo)) : undefined,
    precio_venta: num("precio_venta"),
    precio_renta: num("precio_renta"),
    moneda: moneda ? (CURRENCY_ALIASES[key(moneda)] ?? moneda.toUpperCase()) : undefined,
    provincia: cellText(raw.provincia),
    municipio: cellText(raw.municipio),
    sector: cellText(raw.sector),
    habitaciones: num("habitaciones"),
    banos: num("banos"),
    medios_banos: num("medios_banos"),
    parqueos: num("parqueos"),
    area_construida_m2: num("area_construida_m2"),
    area_terreno_m2: num("area_terreno_m2"),
    descripcion: cellText(raw.descripcion),
    fotos: splitUrls(raw.fotos),
    video: cellText(raw.video),
  };
}

const FIELD_NAMES: Record<string, string> = {
  titulo: "Título", operacion: "Operación", tipo: "Tipo", precio_venta: "Precio de venta", precio_renta: "Precio de renta",
  moneda: "Moneda", habitaciones: "Habitaciones", banos: "Baños", medios_banos: "Medios baños", parqueos: "Parqueos",
  area_construida_m2: "Área construida", area_terreno_m2: "Área de terreno", descripcion: "Descripción", fotos: "Fotos", video: "Video",
  referencia: "Referencia", provincia: "Provincia", municipio: "Municipio", sector: "Sector",
};

export function validateImportRow(raw: Partial<Record<ImportColumn, unknown>>): { data?: ImportRow; errors: string[] } {
  const r = importRowSchema.safeParse(rawToCandidate(raw));
  if (r.success) return { data: r.data, errors: [] };
  const errors = r.error.issues.map((i) => {
    const field = FIELD_NAMES[String(i.path[0])] ?? String(i.path[0] ?? "");
    const msg = i.code === "invalid_type" && i.path[0] && /number/.test(i.message) ? "debe ser un número" : i.message;
    return field ? `${field}: ${msg}` : msg;
  });
  return { errors: [...new Set(errors)] };
}

/**
 * Convierte la hoja (primera fila = encabezados) en filas validadas.
 * Ignora filas vacías y la fila de ayuda de la plantilla.
 */
export function parseImportSheet(sheet: unknown[][]): { rows: ParsedImportRow[]; error?: string } {
  const headerIdx = sheet.findIndex((r) => r.some((c) => columnFor(c) === "titulo"));
  if (headerIdx < 0) return { rows: [], error: "No se encontró la fila de encabezados (debe tener al menos la columna «titulo»)." };
  const cols = sheet[headerIdx].map(columnFor);
  const rows: ParsedImportRow[] = [];
  for (let i = headerIdx + 1; i < sheet.length; i++) {
    const cells = sheet[i];
    if (!cells || cells.every((c) => cellText(c) === undefined)) continue;
    const raw: Partial<Record<ImportColumn, unknown>> = {};
    cols.forEach((c, j) => { if (c) raw[c] = cells[j]; });
    if (String(cellText(raw.titulo) ?? "").startsWith("*")) continue; // fila de ayuda de la plantilla
    if (rows.length >= MAX_IMPORT_ROWS) return { rows, error: `Máximo ${MAX_IMPORT_ROWS} inmuebles por archivo. Divida el archivo.` };
    const v = validateImportRow(raw);
    rows.push({ line: i + 1, data: v.data, errors: v.errors, title: cellText(raw.titulo) ?? "(sin título)" });
  }
  if (!rows.length) return { rows, error: "El archivo no tiene inmuebles debajo de los encabezados." };
  return { rows };
}

/** CSV con separador «,» o «;» (Excel en español usa «;»), comillas dobles y saltos de línea dentro de comillas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Nombre de la empresa de origen normalizado para detectar duplicados. */
export function normalizeSource(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
