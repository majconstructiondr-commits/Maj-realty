"use client";
import { createContext, useContext } from "react";
import type { Dictionary } from "./es";
import type { Locale } from "./index";

/** Partes del diccionario que usan los componentes de cliente (solo se envía el idioma activo). */
export type ClientDictionary = Pick<
  Dictionary,
  "nav" | "common" | "header" | "search" | "map" | "gallery" | "share" | "report" | "form" | "labels" | "mortgage" | "app" | "errorPage"
>;

/**
 * Secciones del área privada (cuenta, panel, editor de publicaciones y panel MAJ) que usan sus componentes
 * de cliente. Solo se envían en esas áreas (PrivateI18nProvider en sus layouts), no en las páginas públicas.
 */
export type PrivateClientDictionary = Pick<Dictionary, "account" | "panel" | "editor" | "admin" | "status">;

type Ctx = { locale: Locale; d: ClientDictionary & Partial<PrivateClientDictionary> };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, d, children }: { locale: Locale; d: ClientDictionary; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, d }}>{children}</I18nContext.Provider>;
}

/** Añade las secciones privadas al diccionario del cliente (se usa dentro de I18nProvider). */
export function PrivateI18nProvider({ d, children }: { d: PrivateClientDictionary; children: React.ReactNode }) {
  const parent = useI18n();
  return <I18nContext.Provider value={{ locale: parent.locale, d: { ...parent.d, ...d } }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n requiere I18nProvider");
  return ctx;
}

/** Diccionario con las secciones privadas (requiere PrivateI18nProvider). */
export function usePrivateI18n() {
  const { locale, d } = useI18n();
  if (!d.account) throw new Error("usePrivateI18n requiere PrivateI18nProvider");
  return { locale, d: d as ClientDictionary & PrivateClientDictionary };
}

export { fmt } from "./fmt";
