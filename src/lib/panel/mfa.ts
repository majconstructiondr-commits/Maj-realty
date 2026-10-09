/** Convierte el código QR devuelto por Supabase (SVG o data URL) en una URL utilizable en <img>. */
export function qrImageSrc(qr: string): string {
  const v = qr.trim();
  if (v.startsWith("data:image/")) return v;
  if (v.startsWith("<svg") || v.startsWith("<?xml")) return `data:image/svg+xml;utf-8,${encodeURIComponent(v)}`;
  return "";
}

/** Un código TOTP válido tiene exactamente 6 dígitos (se toleran espacios al copiarlo). */
export function normalizeTotp(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const c = code.replace(/\s+/g, "");
  return /^\d{6}$/.test(c) ? c : null;
}
