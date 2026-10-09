// Enlaces de descarga de archivos privados: el servidor comprueba el acceso y genera una URL firmada de corta duración.
export type DownloadKind = "archivo" | "adjunto" | "comprobante" | "documento";

export function downloadHref(kind: DownloadKind, id: string) {
  return `/panel/descargar?t=${kind}&id=${encodeURIComponent(id)}`;
}
