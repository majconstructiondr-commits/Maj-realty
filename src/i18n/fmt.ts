/** Sustituye {variables} en un texto del diccionario. Sin dependencias: se usa también en el cliente. */
export function fmt(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
