"use server";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "./index";

/** Guarda el idioma elegido (1 año) y refresca la página actual. */
export async function setLocale(fd: FormData) {
  const value = fd.get(LOCALE_COOKIE);
  if (!isLocale(value)) return;
  (await cookies()).set(LOCALE_COOKIE, value, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  refresh();
}
