"use client";
// Utilidades de carga en el navegador. Las fotos se recomprimen (WebP, máx. 2000 px), lo que además
// elimina metadatos EXIF como coordenadas GPS que podrían revelar la ubicación exacta.

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOC_TYPES = ["application/pdf", ...IMAGE_TYPES];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOC_BYTES = 15 * 1024 * 1024;

export async function compressImage(file: File, maxSide = 2000, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Formato no permitido. Use JPG, PNG o WebP.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return { blob, width, height };
}

export function safeFileName(name: string) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
  return `${crypto.randomUUID()}-${base || "archivo"}`;
}
