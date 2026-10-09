import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/admin/csv";
import { buildChangeDiff } from "@/lib/admin/diff";
import { hrefWith, ilikeTerm, oneOf, pageOf, sortOf } from "@/lib/admin/params";
import { addDays, isoToLocalInput, localDay, localDayStartIso } from "@/lib/admin/time";
import { parseSettingValue, settingKind } from "@/lib/admin/settings";

describe("CSV", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Dice "hola", adiós')).toBe('"Dice ""hola"", adiós"');
    expect(csvCell("línea1\nlínea2")).toBe('"línea1\nlínea2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("sí");
    expect(csvCell(1234.5)).toBe("1234.5");
  });
  it("neutraliza fórmulas en texto", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+1 809")).toBe("'+1 809");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tcmd")).toBe("'\tcmd");
    expect(csvCell(-5)).toBe("-5"); // los números reales no se alteran
  });
  it("arma filas con CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("Diferencias de solicitudes de cambio", () => {
  const current = {
    property: { title: "Apartamento en Piantini", bedrooms: 3, features: { piscina: { v: "si" } }, balcony: "no" },
    private: { street: "Calle Uno", publication_authorized: true },
    prices: [{ operation: "venta", amount: 250000, currency: "USD", negotiable: false, maintenance_included: "desconocido" }],
  };
  it("muestra solo lo que cambia, con etiquetas", () => {
    const rows = buildChangeDiff(
      {
        property: { title: "Apartamento en Piantini", bedrooms: "4", balcony: "si", features: { piscina: { v: "si" }, ascensor: { v: "si", d: "2" } } },
        private: { street: "Calle Dos" },
        prices: [{ operation: "venta", amount: 240000, currency: "USD" }],
      },
      current,
    );
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Habitaciones");
    expect(labels).toContain("Balcón");
    expect(labels).toContain("Característica: Ascensor");
    expect(labels).toContain("Calle");
    expect(labels).toContain("Venta: Precio");
    expect(labels).not.toContain("Título");
    expect(labels).not.toContain("Característica: Piscina");
    expect(labels).not.toContain("Venta: Negociable"); // el valor por defecto coincide
    expect(rows.find((r) => r.label === "Balcón")?.after).toBe("Sí");
  });
  it("marca campos no aplicables y precios eliminados", () => {
    const rows = buildChangeDiff({ property: { status: "publicado" }, prices: [] }, current);
    expect(rows.find((r) => r.field === "status")?.applied).toBe(false);
    expect(rows.find((r) => r.section === "Precios")?.after).toBe("Se elimina");
  });
});

describe("Parámetros de lista", () => {
  it("pagina, ordena y filtra con valores permitidos", () => {
    expect(pageOf({ pagina: "3" }, 25)).toEqual({ page: 3, pageSize: 25, from: 50, to: 74 });
    expect(pageOf({ pagina: "-1" }).page).toBe(1);
    expect(sortOf({ orden: "-title" }, ["title", "code"] as const, "code")).toMatchObject({ column: "title", ascending: false });
    expect(sortOf({ orden: "hack" }, ["title"] as const, "title")).toMatchObject({ column: "title", ascending: false });
    expect(oneOf({ s: "x" }, "s", ["a", "b"])).toBe("");
    expect(hrefWith("/admin/x", { a: "1", pagina: "2" }, { pagina: undefined, b: 3 })).toBe("/admin/x?a=1&b=3");
    expect(ilikeTerm("50%_a,b(c)")).toBe("50\\%\\_a b c");
  });
});

describe("Hora de Santo Domingo", () => {
  it("convierte entre UTC y hora local (UTC-4)", () => {
    expect(isoToLocalInput("2026-10-13T14:00:00.000Z")).toBe("2026-10-13T10:00");
    expect(localDay("2026-10-14T02:00:00.000Z")).toBe("2026-10-13");
    expect(localDayStartIso("2026-10-13")).toBe("2026-10-13T04:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoToLocalInput(null)).toBe("");
  });
});

describe("Configuración", () => {
  it("detecta el tipo y valida", () => {
    expect(settingKind(true)).toBe("boolean");
    expect(settingKind(null)).toBe("text");
    expect(settingKind({ a: 1 })).toBe("json");
    expect(parseSettingValue("text", "  ")).toEqual({ ok: true, value: null });
    expect(parseSettingValue("number", "15")).toEqual({ ok: true, value: 15 });
    expect(parseSettingValue("number", "x").ok).toBe(false);
    expect(parseSettingValue("json", "{bad").ok).toBe(false);
    expect(parseSettingValue("boolean", "on")).toEqual({ ok: true, value: true });
  });
});
