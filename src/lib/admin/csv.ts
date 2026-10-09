// Exportación CSV segura: escapa comillas, separadores y saltos de línea, y neutraliza fórmulas
// (celdas que empiezan con = + - @ tabulador o retorno) para que una hoja de cálculo no las ejecute.

export type CsvValue = string | number | boolean | null | undefined | Date;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") s = Number.isFinite(v) ? String(v) : "";
  else if (typeof v === "boolean") s = v ? "sí" : "no";
  else if (v instanceof Date) s = v.toISOString();
  else {
    s = String(v);
    if (FORMULA_START.test(s)) s = `'${s}`;
  }
  return /[",;\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}
