import { z } from "zod";
import { PROPERTY_TYPES } from "../catalog/definitions";

const s = (max: number) => z.string().trim().max(max);
const optS = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s(max).optional());
const optN = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(/[,\s]/g, ""))),
  z.number().finite().nonnegative().max(1e12).optional(),
);
const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const contactSchema = z
  .object({
    contact_name: s(160).min(2, "Indique su nombre"),
    contact_email: z.preprocess((v) => (v === "" ? undefined : v), z.email("Correo no válido").max(160).optional()),
    contact_phone: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().trim().regex(/^[0-9+()\s-]{7,25}$/, "Teléfono no válido").optional(),
    ),
    preferred_channel: z.enum(["whatsapp", "llamada", "correo", "chat"]).default("whatsapp"),
    message: optS(4000),
    contact_consent: bool.refine((v) => v, "Debe autorizar el contacto para atender su solicitud"),
    marketing_consent: bool,
  })
  .refine((d) => d.contact_email || d.contact_phone, { message: "Indique un correo o un teléfono", path: ["contact_phone"] });

const type = z.preprocess((v) => (v === "" ? undefined : v), z.enum(Object.keys(PROPERTY_TYPES) as [string, ...string[]]).optional());
const currency = z.preprocess((v) => (v === "" ? undefined : v), z.enum(["DOP", "USD"]).optional());

/** Detalles específicos por tipo de solicitud (se guardan en details jsonb). */
export const detailSchemas = {
  contacto: z.object({ asunto: optS(160) }),
  info_inmueble: z.object({}),
  visita: z.object({ fecha_preferida: optS(40) }),
  venta_captacion: z.object({
    tipo: type, provincia: optS(80), municipio: optS(80), sector: optS(120),
    precio_esperado: optN, moneda: currency, autorizado: bool,
    visita_evaluacion: bool, preferencias: optS(1000),
  }),
  renta_publicar: z.object({
    tipo: type, provincia: optS(80), municipio: optS(80), sector: optS(120),
    renta_esperada: optN, moneda: currency, amueblado: optS(20), disponible_desde: optS(20), autorizado: bool,
  }),
  administracion: z.object({
    tipo: type, provincia: optS(80), municipio: optS(80), sector: optS(120),
    unidades: optN, ocupacion: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["ocupado", "vacio", "parcial"]).optional()),
    servicios: z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(z.enum(["cobro_rentas", "mantenimiento", "busqueda_inquilinos", "contratos", "informes", "pagos_servicios"])).max(6)),
    situacion_actual: optS(1000),
  }),
  remodelacion: z.object({
    tipo_trabajo: s(120).min(2, "Indique el tipo de trabajo"),
    area_m2: optN, alcance: optS(2000), presupuesto: optN, moneda: currency,
    provincia: optS(80), municipio: optS(80), sector: optS(120),
    fecha_deseada: optS(20), urgencia: z.enum(["baja", "normal", "alta"]).default("normal"), visita_tecnica: bool,
  }),
  cotizacion: z.object({
    servicio: z.enum(["remodelacion", "administracion", "legal", "venta", "renta", "otro"]),
    referencia_inmueble: optS(60), alcance: s(2000).min(10, "Describa el alcance (mínimo 10 caracteres)"),
  }),
  legal: z.object({ service_code: s(40).min(2, "Seleccione el servicio"), descripcion: s(2000).min(10, "Describa su caso (mínimo 10 caracteres)"), referencia_inmueble: optS(60) }),
  busco_propiedad: z.object({
    operacion: z.enum(["venta", "renta"]), zonas: s(300).min(2, "Indique al menos una zona"),
    presupuesto_max: optN, moneda: currency, tipo: type, habitaciones: optN, fecha: optS(20),
  }),
  publicar_propiedad: z.object({ tipo_publicador: z.enum(["propietario", "vendedor", "agencia"]) }),
} as const;

export type RequestKindWithSchema = keyof typeof detailSchemas;

export function formToObject(fd: FormData) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION") || typeof v !== "string") continue;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
