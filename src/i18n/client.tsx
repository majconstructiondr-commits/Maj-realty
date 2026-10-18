"use client";
import { createContext, useContext } from "react";
import type { Dictionary } from "./es";
import type { Locale } from "./index";

/** Partes del diccionario que usan los componentes de cliente (solo se envía el idioma activo). */
export type ClientDictionary = Pick<
  Dictionary,
  "nav" | "common" | "header" | "search" | "map" | "gallery" | "share" | "report" | "form" | "labels" | "mortgage" | "app" | "errorPage"
>;

const I18nContext = createContext<{ locale: Locale; d: ClientDictionary } | null>(null);

export function I18nProvider({ locale, d, children }: { locale: Locale; d: ClientDictionary; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, d }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n requiere I18nProvider");
  return ctx;
}

export { fmt } from "./fmt";
