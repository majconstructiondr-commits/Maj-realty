// Edición tipada de valores jsonb de site_settings.
export type SettingKind = "boolean" | "number" | "text" | "json";

export function settingKind(value: unknown): SettingKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value === null || typeof value === "string") return "text";
  return "json";
}

/** Convierte lo escrito en el formulario al valor jsonb. Texto vacío = null (dato por confirmar). */
export function parseSettingValue(kind: SettingKind, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const s = raw.trim();
  switch (kind) {
    case "boolean":
      return { ok: true, value: s === "on" || s === "true" };
    case "number": {
      const n = Number(s.replace(",", "."));
      if (s === "" || !Number.isFinite(n)) return { ok: false, error: "Indique un número válido." };
      return { ok: true, value: n };
    }
    case "text":
      return { ok: true, value: s === "" ? null : s };
    case "json":
      try {
        return { ok: true, value: JSON.parse(s) };
      } catch {
        return { ok: false, error: "JSON no válido. Revise comillas, comas y llaves." };
      }
  }
}
