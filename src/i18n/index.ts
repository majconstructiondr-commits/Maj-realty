import { es, type Dictionary } from "./es";
import { en } from "./en";

export type { Dictionary };
export { es, en };
export { fmt } from "./fmt";

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


/**
 * Traduce los mensajes de validación y de error genéricos (definidos en español en es.ts)
 * al idioma del visitante. Los mensajes desconocidos (p. ej. de la base de datos) se devuelven igual.
 */
export function localizeMessage(msg: string, locale: Locale) {
  if (locale === defaultLocale) return msg;
  const d = getDictionary(locale);
  for (const section of ["validation", "dbErrors", "actions"] as const) {
    const source = es[section] as Record<string, string>;
    const key = Object.keys(source).find((k) => source[k] === msg);
    if (key) return (d[section] as Record<string, string>)[key];
  }
  return msg;
}
