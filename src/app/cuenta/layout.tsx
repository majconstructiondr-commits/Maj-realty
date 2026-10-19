import { PrivateI18nProvider } from "@/i18n/client";
import { getI18n, privateDictionary } from "@/i18n/server";

/** Textos de la cuenta para los formularios de cliente (ingresar, registro, seguridad…). */
export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const { d } = await getI18n();
  return <PrivateI18nProvider d={privateDictionary(d)}>{children}</PrivateI18nProvider>;
}
