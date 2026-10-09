import "server-only";
import { isBlockedHost } from "./hosts";

// Descarga segura de fotos indicadas por enlace en la importación de inmuebles.
// Solo https, sin direcciones internas, con límite de tamaño, tiempo y redirecciones.

export const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024; // igual al límite del bucket property-media
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type RemoteImage = { bytes: Uint8Array; contentType: string; ext: string };

export async function fetchRemoteImage(url: string): Promise<RemoteImage> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:") throw new Error("El enlace debe ser https");
    if (u.username || u.password || isBlockedHost(u.hostname)) throw new Error("Enlace no permitido");
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: "image/jpeg,image/png,image/webp" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirección sin destino");
      current = new URL(loc, u).toString();
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`El servidor respondió ${res.status}`);
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = TYPES[contentType];
    if (!ext) throw new Error("No es una imagen JPG, PNG o WebP");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_REMOTE_IMAGE_BYTES) throw new Error("Imagen de más de 10 MB");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REMOTE_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("Imagen de más de 10 MB");
      }
      chunks.push(value);
    }
    if (!size) throw new Error("Imagen vacía");
    const bytes = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
    return { bytes, contentType, ext };
  }
  throw new Error("Demasiadas redirecciones");
}
