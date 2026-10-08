import { describe, expect, it } from "vitest";
import { fillTemplate, normalizeWhatsappNumber, whatsappLink } from "@/lib/whatsapp";
import { convert, formatDate, formatMoney, localDateTimeToIso, totalsByCurrency } from "@/lib/format";
import { mortgage } from "@/lib/mortgage";
import { parseSearch, toQueryString } from "@/lib/catalog/search";
import { contactSchema, detailSchemas } from "@/lib/validation/requests";
import { fieldApplies } from "@/lib/catalog/definitions";

describe("WhatsApp", () => {
  it("codifica referencia y enlace del inmueble", () => {
    const text = fillTemplate("Hola, me interesa {servicio}, referencia {codigo}, enlace {url}", {
      servicio: 'el inmueble "Casa & patio"',
      codigo: "MAJ-001001",
      url: "https://majrealty.com.do/inmuebles/maj-001001-casa?x=1&y=2",
    });
    const link = whatsappLink("809-770-6277", text);
    expect(link.startsWith("https://wa.me/18097706277?text=")).toBe(true);
    const decoded = decodeURIComponent(link.split("?text=")[1]);
    expect(decoded).toBe(text);
    expect(link).not.toContain(" ");
    expect(link).not.toContain("&y=");
  });
  it("omite referencia y enlace cuando no existen", () => {
    expect(fillTemplate("Hola, me interesa {servicio}, referencia {codigo}, enlace {url}", { servicio: "una remodelación" })).toBe(
      "Hola, me interesa una remodelación",
    );
  });
  it("normaliza números dominicanos", () => {
    expect(normalizeWhatsappNumber("849 272 5000")).toBe("18492725000");
    expect(normalizeWhatsappNumber("+1 (809) 770-6277")).toBe("18097706277");
  });
});

describe("Monedas y fechas", () => {
  it("muestra la moneda original", () => {
    expect(formatMoney("285000.00", "USD")).toBe("US$ 285,000");
    expect(formatMoney(12500000, "DOP")).toBe("RD$ 12,500,000");
    expect(formatMoney(null, "DOP")).toBe("Precio a consultar");
  });
  it("no suma monedas distintas", () => {
    expect(totalsByCurrency([{ amount: 100, currency: "USD" }, { amount: "50.5", currency: "DOP" }, { amount: 1, currency: "USD" }])).toEqual({ USD: 101, DOP: 50.5 });
  });
  it("convierte solo con una tasa dada", () => {
    expect(convert(100, { base: "USD", quote: "DOP", rate: 60 }, "USD")).toEqual({ amount: 6000, currency: "DOP" });
    expect(convert(6000, { base: "USD", quote: "DOP", rate: 60 }, "DOP")).toEqual({ amount: 100, currency: "USD" });
  });
  it("usa la hora de Santo Domingo (UTC-4)", () => {
    expect(localDateTimeToIso("2026-10-13T10:00")).toBe("2026-10-13T14:00:00.000Z");
    expect(formatDate("2026-10-13T14:00:00Z", true)).toMatch(/13\/10\/2026.*10:00/);
    expect(formatDate("2026-10-13")).toBe("13/10/2026");
  });
});

describe("Calculadora hipotecaria", () => {
  it("calcula la cuota de amortización", () => {
    const r = mortgage({ price: 200000, downPayment: 40000, annualRatePct: 9, years: 20 })!;
    expect(r.principal).toBe(160000);
    expect(r.monthlyPayment).toBeCloseTo(1439.56, 1);
    expect(r.months).toBe(240);
  });
  it("rechaza datos inválidos", () => {
    expect(mortgage({ price: 100, downPayment: 200, annualRatePct: 5, years: 10 })).toBeNull();
    expect(mortgage({ price: 100, downPayment: 0, annualRatePct: 5, years: 0 })).toBeNull();
  });
});

describe("Búsqueda", () => {
  it("valida filtros y conserva la consulta", () => {
    const f = parseSearch({ provincia: "Santiago", min: "1,000", car: "piscina,inventado", orden: "precio_asc", pagina: "2", tipo: "nave" });
    expect(f.min).toBe(1000);
    expect(f.car).toEqual(["piscina"]);
    expect(toQueryString(f)).toBe("?provincia=Santiago&tipo=nave&min=1000&car=piscina&orden=precio_asc&pagina=2");
  });
  it("ignora valores inválidos", () => {
    const f = parseSearch({ tipo: "castillo" });
    expect(f.tipo).toBeUndefined();
  });
  it("terreno no requiere habitaciones", () => {
    expect(fieldApplies("solar", "bedrooms")).toBe(false);
    expect(fieldApplies("apartamento", "bedrooms")).toBe(true);
  });
});

describe("Validación de formularios", () => {
  it("exige consentimiento y un medio de contacto", () => {
    expect(contactSchema.safeParse({ contact_name: "Ana", contact_consent: "on" }).success).toBe(false);
    expect(contactSchema.safeParse({ contact_name: "Ana", contact_email: "ana@x.do" }).success).toBe(false);
    expect(contactSchema.safeParse({ contact_name: "Ana", contact_email: "ana@x.do", contact_consent: "on" }).success).toBe(true);
  });
  it("valida detalles por tipo", () => {
    expect(detailSchemas.remodelacion.safeParse({ tipo_trabajo: "" }).success).toBe(false);
    expect(detailSchemas.busco_propiedad.safeParse({ operacion: "renta", zonas: "Naco" }).success).toBe(true);
  });
});
