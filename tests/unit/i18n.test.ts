import { describe, expect, it } from "vitest";
import { en, es, fmt, getDictionary, isLocale, localizeMessage } from "@/i18n";
import { contactSchema } from "@/lib/validation/requests";
import { FEATURES, PROPERTY_TYPES } from "@/lib/catalog/definitions";

/** Rutas de todas las hojas del diccionario (p. ej. "nav.home", "home.steps.0.h"). */
function leafPaths(o: unknown, prefix = ""): string[] {
  if (o === null || typeof o !== "object") return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n", () => {
  it("es y en tienen exactamente las mismas claves", () => {
    expect(leafPaths(en).sort()).toEqual(leafPaths(es).sort());
  });
  it("ningún texto en inglés queda vacío", () => {
    for (const p of leafPaths(en)) {
      const v = p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en);
      expect(typeof v, p).toBe("string");
      expect((v as string).length, p).toBeGreaterThan(0);
    }
  });
  it("las etiquetas en español coinciden con los catálogos de la base de datos", () => {
    expect(es.labels.propertyTypes).toEqual(PROPERTY_TYPES);
    expect(Object.keys(en.labels.features).sort()).toEqual(Object.keys(FEATURES).sort());
  });
  it("valida el idioma y usa español por defecto", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(getDictionary()).toBe(es);
  });
  it("sustituye variables", () => {
    expect(fmt(en.catalog.countMany, { n: 12 })).toBe("12 properties");
    expect(fmt("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
  it("traduce los mensajes de validación al inglés y deja intactos los desconocidos", () => {
    const r = contactSchema.safeParse({ contact_name: "", contact_consent: "" });
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs).toContain(es.validation.name);
    expect(localizeMessage(es.validation.name, "en")).toBe(en.validation.name);
    expect(localizeMessage(es.validation.name, "es")).toBe(es.validation.name);
    expect(localizeMessage("Mensaje de la base de datos", "en")).toBe("Mensaje de la base de datos");
  });
});
