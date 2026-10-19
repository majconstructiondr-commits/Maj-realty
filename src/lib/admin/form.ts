// Validación de formularios del panel con zod. Los campos vacíos se tratan como ausentes.
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { fieldErrors, formToObject } from "@/lib/validation/requests";
import { fmt } from "@/i18n/fmt";
import { es } from "@/i18n/es";

// Mensajes en español desde el diccionario; las acciones los traducen al responder (localizeState).
const M = es.admin.msg;
const T = es.admin.tpl;

const blank = (v: unknown) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

export const zText = (max: number, min = 1, msg: string = M.required) =>
  z.string({ error: msg }).trim().min(min, msg).max(max, fmt(T.maxChars, { max }));
export const zOptText = (max: number) =>
  z.preprocess(blank, z.string().trim().max(max, fmt(T.maxChars, { max })).optional());
export const zUuid = z.uuid(M.invalidId);
export const zOptUuid = z.preprocess(blank, z.uuid(M.invalidId).optional());
export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());
export const zNum = (opts: { min?: number; max?: number; int?: boolean; msg?: string } = {}) => {
  let n = z.number({ error: opts.msg ?? M.invalidNumber }).finite();
  if (opts.int) n = n.int(M.integer);
  if (opts.min !== undefined) n = n.min(opts.min, fmt(T.min, { n: opts.min }));
  if (opts.max !== undefined) n = n.max(opts.max, fmt(T.max, { n: opts.max }));
  return z.preprocess((v) => (blank(v) === undefined ? undefined : Number(String(v).replace(/[,\s]/g, ""))), n);
};
export const zOptNum = (opts: Parameters<typeof zNum>[0] = {}) =>
  z.preprocess((v) => (blank(v) === undefined ? undefined : v), zNum(opts).optional());
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, M.invalidDate);
export const zOptDate = z.preprocess(blank, zDate.optional());
export const zLocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, M.invalidDateTime);
export const zOptLocalDateTime = z.preprocess(blank, zLocalDateTime.optional());
export const zCurrency = z.enum(["DOP", "USD"], { error: M.invalidCurrency });
export const zPeriod = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, M.invalidPeriod);
export const zEnumOf = <T extends Record<string, string>>(map: T, msg: string = M.invalidOption) =>
  z.enum(Object.keys(map) as [keyof T & string, ...(keyof T & string)[]], { error: msg });
export const zReason = zText(2000, 3, M.reason);

export type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState };

export function parseForm<S extends z.ZodType>(schema: S, fd: FormData): Parsed<z.infer<S>> {
  const r = schema.safeParse(formToObject(fd));
  if (r.success) return { ok: true, data: r.data };
  const errors = fieldErrors(r.error);
  const first = Object.values(errors)[0];
  return { ok: false, state: { status: "error", message: first ? fmt(T.reviewFormWith, { msg: first }) : M.reviewForm, errors } };
}
