import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLocale, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from "./index";

/** Idioma del visitante según la cookie "idioma" (por defecto, español). */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
});

/** Idioma y diccionario de la petición actual. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, d: getDictionary(locale) };
}
