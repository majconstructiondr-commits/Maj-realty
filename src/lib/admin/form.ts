// Validación de formularios del panel con zod. Los campos vacíos se tratan como ausentes.
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { fieldErrors, formToObject } from "@/lib/validation/requests";

const blank = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

export const zText = (max: number, min = 1, msg = "Campo requerido") =>
  z.string({ error: msg }).trim().min(min, msg).max(max, `Máximo ${max} caracteres`);
export const zOptText = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max, `Máximo ${max} caracteres`).optional());
export const zUuid = z.uuid("Identificador no válido");
export const zOptUuid = z.preprocess(blank, z.uuid("Identificador no válido").optional());
export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());
export const zNum = (opts: { min?: number; max?: number; int?: boolean; msg?: string } = {}) => {
  let n = z.number({ error: opts.msg ?? "Número no válido" }).finite();
  if (opts.int) n = n.int("Debe ser un número entero");
  if (opts.min !== undefined) n = n.min(opts.min, `Mínimo ${opts.min}`);
  if (opts.max !== undefined) n = n.max(opts.max, `Máximo ${opts.max}`);
  return z.preprocess((v) => (blank(v) === undefined ? undefined : Number(String(v).replace(/[,\s]/g, ""))), n);
};
export const zOptNum = (opts: Parameters<typeof zNum>[0] = {}) =>
  z.preprocess((v) => (blank(v) === undefined ? undefined : v), zNum(opts).optional());
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
export const zOptDate = z.preprocess(blank, zDate.optional());
export const zLocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora no válidas");
export const zOptLocalDateTime = z.preprocess(blank, zLocalDateTime.optional());
export const zCurrency = z.enum(["DOP", "USD"], { error: "Moneda no válida" });
export const zPeriod = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período no válido (AAAA-MM)");
export const zEnumOf = <T extends Record<string, string>>(map: T, msg = "Opción no válida") =>
  z.enum(Object.keys(map) as [keyof T & string, ...(keyof T & string)[]], { error: msg });
export const zReason = zText(2000, 3, "Indique el motivo (mínimo 3 caracteres)");

export type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState };

export function parseForm<S extends z.ZodType>(schema: S, fd: FormData): Parsed<z.infer<S>> {
  const r = schema.safeParse(formToObject(fd));
  if (r.success) return { ok: true, data: r.data };
  const errors = fieldErrors(r.error);
  const first = Object.values(errors)[0];
  return { ok: false, state: { status: "error", message: first ? `Revise el formulario: ${first}` : "Revise el formulario.", errors } };
}
