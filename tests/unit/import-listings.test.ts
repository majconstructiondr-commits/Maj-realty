import { describe, expect, it } from "vitest";
import { normalizeSource, parseCsv, parseImportSheet, parseNumber, splitUrls } from "@/lib/import/listings";
import { isBlockedHost } from "@/lib/import/hosts";

describe("importación de inmuebles", () => {
  it("lee números con símbolos y formatos locales", () => {
    expect(parseNumber("US$ 150,000.00")).toBe(150000);
    expect(parseNumber("RD$1.500.000")).toBe(1500000);
    expect(parseNumber("1.500.000,50")).toBe(1500000.5);
    expect(parseNumber(85)).toBe(85);
    expect(parseNumber("")).toBeUndefined();
    expect(parseNumber("a consultar")).toBeNaN();
  });

  it("separa enlaces de fotos", () => {
    expect(splitUrls("https://a.do/1.jpg, https://a.do/2.jpg\nhttps://a.do/3.jpg|https://a.do/4.jpg")).toHaveLength(4);
  });

  it("lee CSV con punto y coma, comillas y saltos de línea", () => {
    const rows = parseCsv('﻿titulo;descripcion\n"Casa; grande";"línea 1\nlínea ""2"""\n');
    expect(rows).toEqual([["titulo", "descripcion"], ["Casa; grande", 'línea 1\nlínea "2"']]);
  });

  it("valida filas, acepta sinónimos y omite la fila de ayuda", () => {
    const sheet = [
      ["Título", "Operación", "Tipo de inmueble", "Precio", "Moneda", "Habs", "Fotos", "Referencia"],
      ["* Título de la publicación", "*", "*", "", "", "", "", ""],
      ["Apartamento en Naco", "Alquiler", "Apto", "", "", 3, "https://x.do/a.jpg", "A-1"],
      ["Villa en Punta Cana", "venta", "villa", "US$ 450,000", "US$", 4, "", ""],
      ["Casa", "permuta", "castillo", "200000", "", "dos", "http://x.do/a.jpg", ""],
      ["", "", "", "", "", "", "", ""],
    ];
    const { rows, error } = parseImportSheet(sheet);
    expect(error).toBeUndefined();
    expect(rows).toHaveLength(3);
    expect(rows[0].data).toMatchObject({ operacion: "renta", tipo: "apartamento", habitaciones: 3, referencia: "A-1", fotos: ["https://x.do/a.jpg"] });
    expect(rows[1].data).toMatchObject({ operacion: "venta", tipo: "villa", precio_venta: 450000, moneda: "USD" });
    expect(rows[2].data).toBeUndefined();
    expect(rows[2].errors.join(" | ")).toMatch(/Título.*Operación|Operación/);
    expect(rows[2].errors.some((e) => e.startsWith("Fotos"))).toBe(true);
  });

  it("exige moneda con precio y precio acorde a la operación", () => {
    const { rows } = parseImportSheet([["titulo", "operacion", "tipo", "precio_renta", "moneda"], ["Local en Piantini", "venta", "local", "50000", "DOP"]]);
    expect(rows[0].errors.some((e) => e.startsWith("Precio de renta"))).toBe(true);
  });

  it("informa si falta el encabezado", () => {
    expect(parseImportSheet([["a", "b"], ["c", "d"]]).error).toMatch(/encabezados/);
  });

  it("normaliza el nombre de la empresa", () => {
    expect(normalizeSource("  Inmobiliaria  Pérez ")).toBe("inmobiliaria perez");
  });

  it("bloquea hosts internos al descargar fotos", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.20.0.1", "[::1]", "intranet", "2130706433", "x.internal"]) {
      expect(isBlockedHost(h)).toBe(true);
    }
    expect(isBlockedHost("images.example.com")).toBe(false);
    expect(isBlockedHost("8.8.8.8")).toBe(false);
  });
});
