import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLocale, getDictionary, isLocale, LOCALE_COOKIE, type Dictionary, type Locale } from "./index";
import type { PrivateClientDictionary } from "./client";

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

/** Secciones privadas del diccionario para los componentes de cliente (PrivateI18nProvider). */
export function privateDictionary(d: Dictionary): PrivateClientDictionary {
  return { account: d.account, panel: d.panel, editor: d.editor, admin: d.admin, status: d.status };
}
