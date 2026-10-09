import { describe, expect, it } from "vitest";
import {
  basicSchema, buildChangeSet, initialNumericMode, initialSpaceValue, isLiveStatus, locationSchema, mergeSection, missingForReview,
  newDraftSchema, numericFieldKeys, parseDistribution, parseFeatures, parsePrices, parseStep, privateSchema, samePrices,
} from "@/lib/listing-editor/schemas";
import { availableActions, duplicateTitle } from "@/lib/listing-editor/transitions";

/** Formulario de distribución con todos los campos en "desconocido" salvo los indicados. */
function distForm(over: Record<string, string> = {}) {
  const f: Record<string, string> = {};
  for (const k of numericFieldKeys) f[`${k}__modo`] = "desconocido";
  return { ...f, ...over };
}

describe("pasos", () => {
  it("interpreta ?paso= por número o clave y usa 1 por defecto", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep("multimedia")).toBe(6);
    expect(parseStep(["8"])).toBe(8);
    expect(parseStep("99")).toBe(1);
    expect(parseStep(undefined)).toBe(1);
  });
  it("solo borrador y rechazado se editan directamente", () => {
    expect(isLiveStatus("borrador")).toBe(false);
    expect(isLiveStatus("rechazado")).toBe(false);
    for (const s of ["en_revision", "publicado", "pausado", "reservado"]) expect(isLiveStatus(s)).toBe(true);
  });
});

describe("paso 1: datos básicos", () => {
  it("exige título de 5+ caracteres, operación y tipo válidos", () => {
    const r = basicSchema.safeParse({ title: "Casa", operation: "permuta", property_type: "castillo" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["title", "operation", "property_type"]));
  });
  it("normaliza vacíos a null", () => {
    const r = basicSchema.parse({ title: "  Apartamento en Naco  ", operation: "venta", property_type: "apartamento", condition: "", description: "", available_from: "" });
    expect(r).toMatchObject({ title: "Apartamento en Naco", condition: null, description: "", available_from: null });
  });
  it("rechaza fechas mal formadas", () => {
    expect(basicSchema.safeParse({ title: "Apartamento", operation: "venta", property_type: "casa", available_from: "13/10/2026" }).success).toBe(false);
  });
  it("nuevo borrador: organización opcional debe ser uuid", () => {
    expect(newDraftSchema.parse({ title: "Solar en Bávaro", operation: "venta", property_type: "solar", organization_id: "" }).organization_id).toBeNull();
    expect(newDraftSchema.safeParse({ title: "Solar en Bávaro", operation: "venta", property_type: "solar", organization_id: "x" }).success).toBe(false);
  });
});

describe("paso 2: ubicación", () => {
  const base = { province: "Distrito Nacional", municipality: "Santo Domingo de Guzmán", sector: "Piantini" };
  it("separa datos públicos y privados; la dirección pública se anula sin autorización", () => {
    const r = locationSchema.parse({ ...base, street: "Calle 1", exact_lat: "18.47", exact_lng: "-69.94", public_address: "Calle 1 #10" });
    expect(r.property).toEqual({ ...base, exact_address_public: false, public_address: null });
    expect(r.private).toMatchObject({ street: "Calle 1", exact_lat: 18.47, exact_lng: -69.94, unit: null });
  });
  it("mostrar dirección exacta exige confirmar la autorización del propietario y la dirección", () => {
    const r = locationSchema.safeParse({ ...base, exact_address_public: "on" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["owner_authorized_address", "public_address"]));
    const ok = locationSchema.parse({ ...base, exact_address_public: "on", owner_authorized_address: "on", public_address: "Av. Abraham Lincoln 100" });
    expect(ok.property.public_address).toBe("Av. Abraham Lincoln 100");
  });
  it("latitud y longitud van juntas y dentro de rango", () => {
    expect(locationSchema.safeParse({ ...base, exact_lat: "18.4" }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, exact_lat: "95", exact_lng: "-69" }).success).toBe(false);
  });
  it("solo provincias de la lista", () => {
    expect(locationSchema.safeParse({ ...base, province: "Narnia" }).success).toBe(false);
    expect(locationSchema.safeParse({ ...base, province: "" }).success).toBe(true);
  });
});

describe("paso 3: precios", () => {
  it("importe vacío = a consultar (fila con amount null)", () => {
    const r = parsePrices({ venta_amount: "", venta_currency: "USD" }, "venta");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toEqual([expect.objectContaining({ operation: "venta", amount: null, currency: "USD", rent_period: null })]);
  });
  it("una fila por operación aplicable; los campos de renta solo en renta", () => {
    const r = parsePrices(
      { venta_amount: "250,000", venta_currency: "USD", venta_deposit_months: "2", renta_amount: "45000", renta_currency: "DOP", renta_deposit_months: "2", renta_maintenance_amount: "3500" },
      "ambas",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [v, rt] = r.rows;
    expect(v).toMatchObject({ operation: "venta", amount: 250000, deposit_months: null });
    expect(rt).toMatchObject({ operation: "renta", amount: 45000, rent_period: "mensual", deposit_months: 2, maintenance_amount: 3500, maintenance_currency: "DOP" });
  });
  it("ignora bloques de operaciones no aplicables y exige moneda", () => {
    const r = parsePrices({ renta_amount: "100", venta_amount: "x" }, "renta");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(["renta_currency"]);
  });
  it("rechaza importes negativos o no numéricos", () => {
    const r = parsePrices({ venta_amount: "-5", venta_currency: "DOP" }, "venta");
    expect(r.ok).toBe(false);
    const r2 = parsePrices({ venta_amount: "mucho", venta_currency: "DOP" }, "venta");
    expect(r2.ok).toBe(false);
  });
});

describe("paso 4: cero, desconocido y no aplica", () => {
  it("valor 0 se guarda como 0 (no como desconocido)", () => {
    const r = parseDistribution(distForm({ parking_spaces__modo: "valor", parking_spaces: "0" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.parking_spaces).toBe(0);
      expect(r.data.na_fields).not.toContain("parking_spaces");
    }
  });
  it("desconocido = NULL fuera de na_fields; no aplica = NULL dentro de na_fields", () => {
    const r = parseDistribution(distForm({ bedrooms__modo: "no_aplica", bedrooms: "3", bathrooms__modo: "desconocido", bathrooms: "2" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.bedrooms).toBeNull();
    expect(r.data.na_fields).toEqual(["bedrooms"]);
    expect(r.data.bathrooms).toBeNull();
    expect(r.data.na_fields).not.toContain("bathrooms");
  });
  it("modo valor sin número es un error explícito", () => {
    const r = parseDistribution(distForm({ bedrooms__modo: "valor", bedrooms: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.bedrooms).toMatch(/0 es válido/);
  });
  it("respeta rangos y enteros", () => {
    expect(parseDistribution(distForm({ bedrooms__modo: "valor", bedrooms: "2.5" })).ok).toBe(false);
    expect(parseDistribution(distForm({ year_built__modo: "valor", year_built: "1700" })).ok).toBe(false);
    const r = parseDistribution(distForm({ floor_number__modo: "valor", floor_number: "-1", built_area_m2__modo: "valor", built_area_m2: "120.5" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.data.floor_number, r.data.built_area_m2]).toEqual([-1, 120.5]);
  });
  it("espacios tri-estado y modo inválido", () => {
    const r = parseDistribution(distForm({ balcony: "si", patio: "no_aplica" }));
    expect(r.ok && [r.data.balcony, r.data.patio, r.data.terrace]).toEqual(["si", "no_aplica", "desconocido"]);
    expect(parseDistribution(distForm({ balcony: "tal vez" })).ok).toBe(false);
    expect(parseDistribution(distForm({ bedrooms__modo: "quizas" })).ok).toBe(false);
  });
  it("modo inicial: na_fields → no aplica; valor guardado (incl. 0) → valor; tipo sin el campo → no aplica", () => {
    expect(initialNumericMode("bedrooms", null, [], "solar")).toBe("no_aplica");
    expect(initialNumericMode("land_area_m2", null, [], "solar")).toBe("desconocido");
    expect(initialNumericMode("bedrooms", 0, [], "apartamento")).toBe("valor");
    expect(initialNumericMode("bedrooms", "0", [], "solar")).toBe("valor");
    expect(initialNumericMode("parking_spaces", null, ["parking_spaces"], "casa")).toBe("no_aplica");
    expect(initialNumericMode("bathrooms", null, [], "casa")).toBe("desconocido");
    expect(initialSpaceValue("balcony", "desconocido", "solar")).toBe("no_aplica");
    expect(initialSpaceValue("balcony", "si", "solar")).toBe("si");
    expect(initialSpaceValue("patio", "desconocido", "solar")).toBe("desconocido");
  });
});

describe("paso 5: características", () => {
  it("guarda sí/no/no aplica con detalle; omite desconocido sin detalle", () => {
    const r = parseFeatures({ feat_piscina: "si", feat_ascensor: "no", feat_planta_electrica: "si", feat_planta_electrica_detalle: "Áreas comunes", feat_gimnasio: "desconocido", feat_mascotas: "desconocido", feat_mascotas_detalle: "Consultar", condo_rules: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.features).toEqual({
      piscina: { v: "si" }, ascensor: { v: "no" }, planta_electrica: { v: "si", d: "Áreas comunes" }, mascotas: { v: "desconocido", d: "Consultar" },
    });
    expect(r.data.condo_rules).toBeNull();
  });
  it("rechaza valores fuera del tri-estado", () => {
    expect(parseFeatures({ feat_piscina: "claro" }).ok).toBe(false);
  });
});

describe("paso 7: datos privados", () => {
  it("autorizar publicación exige fecha; vencimiento no anterior", () => {
    expect(privateSchema.safeParse({ publication_authorized: "on" }).success).toBe(false);
    expect(privateSchema.safeParse({ publication_authorized: "on", authorization_date: "2026-10-01", authorization_expires: "2026-09-01" }).success).toBe(false);
    const ok = privateSchema.parse({ publication_authorized: "on", authorization_date: "2026-10-01", exclusivity: "si", owner_email: "", survey_status: "deslindado" });
    expect(ok).toMatchObject({ publication_authorized: true, exclusivity: true, owner_email: null, survey_status: "deslindado" });
  });
  it("exclusividad sin indicar es null y no admite vencimiento", () => {
    expect(privateSchema.parse({}).exclusivity).toBeNull();
    expect(privateSchema.safeParse({ exclusivity: "no", exclusivity_expires: "2027-01-01" }).success).toBe(false);
    expect(privateSchema.safeParse({ owner_email: "no-es-correo" }).success).toBe(false);
  });
});

describe("requisitos para revisión (assert_listing_complete)", () => {
  const complete = {
    province: "Santiago", municipality: "Santiago de los Caballeros", description: "x".repeat(30), operation: "ambas" as const,
    priceOperations: ["venta", "renta"], photoCount: 1, publicationAuthorized: true,
  };
  it("sin faltantes cuando todo está completo", () => {
    expect(missingForReview(complete)).toEqual([]);
  });
  it("lista lo que falta con las mismas etiquetas que la base de datos", () => {
    expect(missingForReview({ ...complete, province: "", description: "corta", priceOperations: ["venta"], photoCount: 0, publicationAuthorized: false })).toEqual([
      "provincia", "descripción (mínimo 30 caracteres)", "precio de renta", "al menos una foto", "autorización de publicación",
    ]);
    expect(missingForReview({ ...complete, operation: "venta", priceOperations: [] })).toEqual(["precio de venta"]);
  });
});

describe("solicitudes de cambio", () => {
  it("solo conserva campos distintos de lo publicado (numéricos como texto o número)", () => {
    const current = { title: "Casa en Gurabo", built_area_m2: "120.00", na_fields: ["floor_number", "bedrooms"] };
    expect(mergeSection(current, { title: "Casa en Gurabo", built_area_m2: 120, na_fields: ["bedrooms", "floor_number"] }, undefined)).toBeUndefined();
    expect(mergeSection(current, { title: "Casa amplia en Gurabo", built_area_m2: 120 }, undefined)).toEqual({ title: "Casa amplia en Gurabo" });
  });
  it("combina con la solicitud pendiente y retira campos que vuelven al valor publicado", () => {
    const current = { title: "A", description: "B", bedrooms: 2 };
    const pending = { property: { title: "A2", bedrooms: 3 } };
    const set = buildChangeSet(pending, { property: { current, next: { bedrooms: 2, description: "B2" } } });
    expect(set).toEqual({ property: { title: "A2", description: "B2" } });
  });
  it("precios: se reemplazan completos solo si cambian; se mantienen los pendientes de otras secciones", () => {
    const cur = [{ operation: "venta", amount: "100.00", currency: "USD", negotiable: false, maintenance_included: "desconocido" }];
    const next = parsePrices({ venta_amount: "100", venta_currency: "USD" }, "venta");
    if (!next.ok) throw new Error("precio");
    expect(samePrices(cur, next.rows as unknown as Record<string, unknown>[])).toBe(true);
    expect(buildChangeSet({ private: { unit: "5B" } }, { prices: { current: cur, next: next.rows } })).toEqual({ private: { unit: "5B" } });
    const changed = parsePrices({ venta_amount: "95000", venta_currency: "USD" }, "venta");
    if (!changed.ok) throw new Error("precio");
    expect(buildChangeSet(null, { prices: { current: cur, next: changed.rows } })?.prices?.[0].amount).toBe(95000);
  });
  it("sin cambios devuelve null", () => {
    expect(buildChangeSet(null, { property: { current: { title: "X" }, next: { title: "X" } } })).toBeNull();
  });
});

describe("acciones rápidas", () => {
  it("reflejan las transiciones permitidas por la base de datos", () => {
    expect(availableActions("borrador", "venta")).toEqual(["enviar", "archivar"]);
    expect(availableActions("en_revision", "venta")).toEqual(["retirar"]);
    expect(availableActions("publicado", "venta")).toEqual(["pausar", "reservar", "vendido", "archivar"]);
    expect(availableActions("publicado", "renta")).toEqual(["pausar", "reservar", "rentado", "archivar"]);
    expect(availableActions("reservado", "ambas")).toEqual(["quitar_reserva", "vendido", "rentado"]);
    expect(availableActions("pausado", "venta")).toEqual(["reenviar", "archivar"]);
    expect(availableActions("archivado", "venta")).toEqual([]);
  });
  it("el título duplicado no excede 140 caracteres", () => {
    expect(duplicateTitle("x".repeat(140)).length).toBe(140);
    expect(duplicateTitle("Villa en Cap Cana")).toBe("Copia de Villa en Cap Cana");
  });
});
