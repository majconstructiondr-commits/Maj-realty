import { es } from "./es";
import { en } from "./en";

export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";
// El inglés queda desactivado hasta revisar traducciones (activar con NEXT_PUBLIC_ENABLE_EN=true).
export const enabledLocales: Locale[] = process.env.NEXT_PUBLIC_ENABLE_EN === "true" ? ["es", "en"] : ["es"];

const dictionaries = { es, en };
export function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale] ?? es;
}
export const t = getDictionary(defaultLocale);
