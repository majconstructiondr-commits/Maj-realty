import { describe, expect, it } from "vitest";
import { en, es, fmt, localizeMessage } from "@/i18n";
import { importMsgEn, importMsgEs, localizeImportMessage } from "@/i18n/sections/import-msg";
import { buildChangeDiff, DIFF_TEXT_ES, type DiffText } from "@/lib/admin/diff";
import { validateImportRow } from "@/lib/import/listings";
import { LEGAL_DOCS, legalDocs } from "@/lib/legal/drafts";

describe("i18n de las áreas privadas", () => {
  it("traduce mensajes con variables y nombres de campo", () => {
    const msg = fmt(es.editor.tpl.maxChars, { label: es.editor.fieldLabels.street, max: 120 });
    expect(localizeMessage(msg, "en")).toBe(fmt(en.editor.tpl.maxChars, { label: en.editor.fieldLabels.street, max: 120 }));
    expect(localizeMessage(msg, "es")).toBe(msg);
  });

  it("traduce el mensaje compuesto de los formularios del panel", () => {
    const inner = fmt(es.admin.tpl.maxChars, { max: 500 });
    const msg = fmt(es.admin.tpl.reviewFormWith, { msg: inner });
    expect(localizeMessage(msg, "en")).toBe(fmt(en.admin.tpl.reviewFormWith, { msg: fmt(en.admin.tpl.maxChars, { max: 500 }) }));
  });

  it("traduce los errores de filas de importación con su columna", () => {
    const { errors } = validateImportRow({ titulo: "abc", operacion: "venta", tipo: "casa" });
    expect(errors.length).toBeGreaterThan(0);
    const translated = errors.map((e) => localizeImportMessage(e, importMsgEn));
    expect(translated).toContain(`${importMsgEn.fields.titulo}: ${importMsgEn.msg.titleMin}`);
    expect(errors.map((e) => localizeImportMessage(e, importMsgEs))).toEqual(errors);
  });

  it("arma el resumen de cambios con los textos del idioma indicado", () => {
    const text: DiffText = {
      ...DIFF_TEXT_ES,
      fields: en.admin.diff.fields, numericFields: en.labels.numericFields, spaceFields: en.labels.spaceFields,
      features: en.labels.features, operations: en.labels.operations, tri: en.labels.tri,
      yes: en.admin.common.yes, no: en.admin.common.no, removed: en.admin.diff.removed, feature: en.admin.diff.feature,
    };
    const rows = buildChangeDiff(
      { property: { balcony: "si" }, private: { street: "Calle Dos" } },
      { property: { balcony: "no" }, private: { street: "Calle Uno" }, prices: [] },
      { text },
    );
    expect(rows.find((r) => r.field === "street")?.label).toBe(en.admin.diff.fields.street);
    expect(rows.find((r) => r.field === "balcony")?.after).toBe(en.labels.tri.si);
  });

  it("las traducciones de referencia de los documentos legales cubren los mismos documentos", () => {
    const enDocs = legalDocs("en");
    expect(Object.keys(enDocs).sort()).toEqual(Object.keys(LEGAL_DOCS).sort());
    for (const k of Object.keys(LEGAL_DOCS)) {
      expect(enDocs[k].sections.length, k).toBe(LEGAL_DOCS[k].sections.length);
    }
    expect(legalDocs("es")).toBe(LEGAL_DOCS);
  });
});
