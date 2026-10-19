// Componentes de servidor: toman las etiquetas del diccionario del idioma activo.
import type { ListingStatus } from "@/lib/catalog/definitions";
import { getI18n } from "@/i18n/server";

const CLS: Record<ListingStatus, string> = {
  borrador: "badge",
  en_revision: "badge badge-warning",
  publicado: "badge badge-success",
  pausado: "badge badge-warning",
  reservado: "badge badge-gold",
  vendido: "badge badge-navy",
  rentado: "badge badge-navy",
  rechazado: "badge badge-danger",
  archivado: "badge",
};

export async function StatusBadge({ status }: { status: ListingStatus }) {
  const { d } = await getI18n();
  return <span className={CLS[status] ?? "badge"}>{d.status.listing[status] ?? status}</span>;
}

const GENERIC: Record<string, string> = {
  pendiente: "badge badge-warning",
  documentos_requeridos: "badge badge-warning",
  aprobada: "badge badge-success",
  aprobado: "badge badge-success",
  rechazada: "badge badge-danger",
  rechazado: "badge badge-danger",
  retirado: "badge",
  activa: "badge badge-success",
  vencida: "badge badge-danger",
  suspendida: "badge badge-danger",
  cancelada: "badge",
};

/** Insignia para solicitudes, licencias, pagos y organizaciones. */
export async function StateBadge({ value }: { value: string }) {
  const { d } = await getI18n();
  return <span className={GENERIC[value] ?? "badge"}>{d.editor.badges[value] ?? value}</span>;
}
