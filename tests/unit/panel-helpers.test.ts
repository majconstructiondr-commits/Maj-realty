import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { normalizeTotp, qrImageSrc } from "@/lib/panel/mfa";
import { isUnread } from "@/lib/panel/conversations";
import { groupStatements, periodLabel } from "@/lib/panel/statements";
import { bookingWindow, describeHours, isValidSlot, localDate, timeSlots, weekdayOf } from "@/lib/panel/appointments";
import { describeSavedSearch, parseCatalogPath, savedSearchHref } from "@/lib/panel/saved-search";
import { label, statusBadge, QUOTE_STATUSES } from "@/lib/panel/labels";

describe("safeNext", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/panel/mensajes?x=1")).toBe("/panel/mensajes?x=1");
    expect(safeNext("/admin#a")).toBe("/admin#a");
  });
  it("rechaza redirecciones abiertas", () => {
    for (const v of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", "/\tx", null, undefined, 3, "/a\\b"]) {
      expect(safeNext(v, "/panel")).toBe("/panel");
    }
  });
  it("usa el valor por defecto indicado", () => {
    expect(safeNext("javascript:alert(1)", "/")).toBe("/");
  });
});

describe("MFA", () => {
  it("convierte SVG en data URL", () => {
    expect(qrImageSrc("<svg></svg>")).toMatch(/^data:image\/svg\+xml;utf-8,%3Csvg/);
    expect(qrImageSrc("data:image/svg+xml;utf-8,abc")).toBe("data:image/svg+xml;utf-8,abc");
    expect(qrImageSrc("javascript:x")).toBe("");
  });
  it("normaliza códigos TOTP", () => {
    expect(normalizeTotp("123 456")).toBe("123456");
    expect(normalizeTotp("12345")).toBeNull();
    expect(normalizeTotp("abcdef")).toBeNull();
    expect(normalizeTotp(undefined)).toBeNull();
  });
});

describe("isUnread", () => {
  it("compara último mensaje y última lectura", () => {
    expect(isUnread("2026-10-08T10:00:00Z", null)).toBe(true);
    expect(isUnread("2026-10-08T10:00:00Z", "2026-10-08T09:00:00Z")).toBe(true);
    expect(isUnread("2026-10-08T10:00:00Z", "2026-10-08T10:00:00Z")).toBe(false);
    expect(isUnread(null, null)).toBe(false);
  });
});

describe("groupStatements", () => {
  it("agrupa por período y moneda sin mezclar monedas", () => {
    const g = groupStatements([
      { period: "2026-08", currency: "USD", ingresos: "100.10", egresos: "20", balance: "80.10", pendientes_conciliar: 1 },
      { period: "2026-09", currency: "USD", ingresos: 50, egresos: 0, balance: 50, pendientes_conciliar: 0 },
      { period: "2026-09", currency: "DOP", ingresos: "30000", egresos: "5000", balance: "25000", pendientes_conciliar: "2" },
    ]);
    expect(g.map((x) => x.period)).toEqual(["2026-09", "2026-08"]);
    expect(g[0].rows.map((r) => r.currency)).toEqual(["DOP", "USD"]);
    expect(g[0].rows[0]).toEqual({ currency: "DOP", ingresos: 30000, egresos: 5000, balance: 25000, pendientes: 2 });
    expect(g[1].rows).toHaveLength(1);
    expect(g[1].rows[0].balance).toBe(80.1);
  });
  it("etiqueta períodos", () => {
    expect(periodLabel("2026-09")).toBe("septiembre 2026");
    expect(periodLabel("x")).toBe("x");
  });
});

describe("citas", () => {
  const hours = { "1": ["09:00", "17:00"], "6": ["09:00", "13:00"] } as Record<string, [string, string]>;
  it("calcula el día de la semana", () => {
    expect(weekdayOf("2026-10-12")).toBe(1); // lunes
    expect(weekdayOf("2026-02-30")).toBeNull();
    expect(weekdayOf("12/10/2026")).toBeNull();
  });
  it("genera horarios que caben en el horario de atención", () => {
    const s = timeSlots(hours, "2026-10-17", 60); // sábado
    expect(s[0]).toBe("09:00");
    expect(s[s.length - 1]).toBe("12:00");
    expect(timeSlots(hours, "2026-10-18", 60)).toEqual([]); // domingo
  });
  it("valida una hora elegida", () => {
    expect(isValidSlot(hours, "2026-10-12", "16:00", 60)).toBe(true);
    expect(isValidSlot(hours, "2026-10-12", "16:30", 60)).toBe(false);
    expect(isValidSlot(hours, "2026-10-12", "08:00", 60)).toBe(false);
  });
  it("describe el horario semanal", () => {
    const d = describeHours(hours);
    expect(d[0]).toEqual({ day: "lunes", hours: "09:00 – 17:00" });
    expect(d[6]).toEqual({ day: "domingo", hours: "Cerrado" });
  });
  it("ventana de reserva", () => {
    const w = bookingWindow(12, new Date("2026-10-08T20:00:00Z")); // 16:00 en Santo Domingo
    expect(w.minDate).toBe("2026-10-09");
    expect(w.maxDate).toBe("2027-01-05");
  });
  it("fecha local de Santo Domingo", () => {
    expect(localDate(new Date("2026-10-09T02:00:00Z"))).toBe("2026-10-08");
    expect(localDate(new Date("2026-10-09T05:00:00Z"))).toBe("2026-10-09");
  });
});

describe("búsquedas guardadas", () => {
  it("interpreta solo rutas del catálogo y parámetros conocidos", () => {
    expect(parseCatalogPath("/venta?tipo=casa&provincia=Santiago&pagina=3&evil=1")).toEqual({ operation: "venta", qs: "provincia=Santiago&tipo=casa" });
    expect(parseCatalogPath("/renta")).toEqual({ operation: "renta", qs: "" });
    expect(parseCatalogPath("https://x.com/venta")).toBeNull();
    expect(parseCatalogPath("/admin?x=1")).toBeNull();
  });
  it("reconstruye el enlace", () => {
    expect(savedSearchHref({ operation: "venta", qs: "tipo=casa" })).toBe("/venta?tipo=casa");
    expect(savedSearchHref({ operation: "renta", qs: "" })).toBe("/renta");
    expect(savedSearchHref({ operation: "otra" })).toBeNull();
    expect(savedSearchHref(null)).toBeNull();
  });
  it("resume la búsqueda", () => {
    expect(describeSavedSearch({ operation: "venta", qs: "tipo=casa&hab=3" })).toBe("Tipo: casa · Habitaciones: 3");
    expect(describeSavedSearch({ operation: "venta", qs: "" })).toBe("Todos los inmuebles");
  });
});

describe("etiquetas", () => {
  it("traduce estados", () => {
    expect(label(QUOTE_STATUSES, "vencida")).toBe("Vencida");
    expect(label(QUOTE_STATUSES, "algo_nuevo")).toBe("algo nuevo");
    expect(statusBadge("confirmada")).toContain("badge-success");
    expect(statusBadge("vencida")).toContain("badge-danger");
  });
});
