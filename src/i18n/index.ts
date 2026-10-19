import { es, type Dictionary } from "./es";
import { en } from "./en";

export type { Dictionary };
export { es, en };
import { fmt } from "./fmt";
export { fmt };

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";
/** Cookie donde se guarda el idioma elegido por el visitante (las URL no cambian). */
export const LOCALE_COOKIE = "idioma";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

const dictionaries: Record<Locale, Dictionary> = { es, en };
export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale] ?? es;
}


// Secciones con mensajes de validación y de error (definidos en español en el diccionario).
const MESSAGE_SOURCES: ((d: Dictionary) => Record<string, string>)[] = [
  (d) => d.validation, (d) => d.dbErrors, (d) => d.actions,
  (d) => d.account.msg, (d) => d.panel.msg, (d) => d.editor.msg, (d) => d.admin.msg, (d) => d.admin.importer.msg,
];

// Mensajes con variables ("{label} admite como máximo {max} caracteres") y los nombres de campo
// que pueden aparecer en {label}.
const TEMPLATE_SOURCES: ((d: Dictionary) => Record<string, string>)[] = [(d) => d.editor.tpl, (d) => d.admin.tpl, (d) => d.admin.importer.tpl];
const LABEL_SOURCES: ((d: Dictionary) => Record<string, string>)[] = [
  (d) => d.editor.fieldLabels, (d) => d.labels.numericFields, (d) => d.labels.spaceFields, (d) => d.labels.features,
  (d) => d.status.roles,
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let templateCache: { re: RegExp; vars: string[]; source: number; key: string }[] | null = null;
function templates() {
  if (templateCache) return templateCache;
  templateCache = [];
  TEMPLATE_SOURCES.forEach((source, i) => {
    for (const [key, text] of Object.entries(source(es))) {
      const vars: string[] = [];
      const pattern = text.split(/(\{\w+\})/).map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (!m) return escapeRe(part);
        vars.push(m[1]);
        return "(.+?)";
      }).join("");
      templateCache!.push({ re: new RegExp(`^${pattern}$`), vars, source: i, key });
    }
  });
  return templateCache;
}

function localizeLabel(value: string, d: Dictionary) {
  for (const source of LABEL_SOURCES) {
    const values = source(es);
    const key = Object.keys(values).find((k) => values[k] === value);
    if (key) return source(d)[key];
  }
  return value;
}

/**
 * Traduce los mensajes de validación y de error genéricos (definidos en español en el diccionario)
 * al idioma del visitante. Los mensajes desconocidos (p. ej. de la base de datos) se devuelven igual.
 */
export function localizeMessage(msg: string, locale: Locale): string {
  if (locale === defaultLocale) return msg;
  const d = getDictionary(locale);
  for (const source of MESSAGE_SOURCES) {
    const values = source(es);
    const key = Object.keys(values).find((k) => values[k] === msg);
    if (key) return source(d)[key];
  }
  for (const t of templates()) {
    const m = t.re.exec(msg);
    if (!m) continue;
    // Cada variable es un nombre de campo o, si no, otro mensaje conocido (p. ej. "Revise el formulario: {msg}").
    const vars: Record<string, string> = Object.fromEntries(t.vars.map((v, i): [string, string] => {
      const label = localizeLabel(m[i + 1], d);
      return [v, label !== m[i + 1] ? label : localizeMessage(m[i + 1], locale)];
    }));
    return fmt(TEMPLATE_SOURCES[t.source](d)[t.key], vars);
  }
  return msg;
}

/** Traduce el mensaje de un resultado simple ({ ok, message }). */
export function localizeResult<T extends { message: string }>(r: T, locale: Locale): T {
  return locale === defaultLocale ? r : { ...r, message: localizeMessage(r.message, locale) };
}

/** Traduce el mensaje y los errores por campo de un estado de acción. */
export function localizeState<T extends { status: string; message?: string; errors?: Record<string, string> }>(state: T, locale: Locale): T {
  if (locale === defaultLocale || !("message" in state) || typeof state.message !== "string") return state;
  const errors = state.errors
    ? Object.fromEntries(Object.entries(state.errors).map(([k, v]) => [k, localizeMessage(v, locale)]))
    : undefined;
  return { ...state, message: localizeMessage(state.message, locale), ...(errors ? { errors } : {}) };
}
