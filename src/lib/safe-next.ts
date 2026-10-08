/**
 * Devuelve una ruta interna segura para redirigir después de iniciar sesión o confirmar un enlace.
 * Solo acepta rutas relativas que empiecen por "/" y no por "//" (evita redirecciones abiertas).
 */
export function safeNext(value: unknown, fallback = "/panel"): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v || v.length > 500) return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  // Caracteres de control o barras invertidas pueden reinterpretarse como otro origen.
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return fallback;
  try {
    const u = new URL(v, "http://local.invalid");
    if (u.origin !== "http://local.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
