import { STATUSES, type ListingStatus } from "@/lib/catalog/definitions";

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

export function StatusBadge({ status }: { status: ListingStatus }) {
  return <span className={CLS[status] ?? "badge"}>{STATUSES[status] ?? status}</span>;
}

const GENERIC: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "badge badge-warning" },
  documentos_requeridos: { label: "Documentos requeridos", cls: "badge badge-warning" },
  aprobada: { label: "Aprobada", cls: "badge badge-success" },
  aprobado: { label: "Aprobado", cls: "badge badge-success" },
  rechazada: { label: "Rechazada", cls: "badge badge-danger" },
  rechazado: { label: "Rechazado", cls: "badge badge-danger" },
  retirado: { label: "Reemplazada", cls: "badge" },
  activa: { label: "Activa", cls: "badge badge-success" },
  vencida: { label: "Vencida", cls: "badge badge-danger" },
  suspendida: { label: "Suspendida", cls: "badge badge-danger" },
  cancelada: { label: "Cancelada", cls: "badge" },
};

/** Insignia para solicitudes, licencias, pagos y organizaciones. */
export function StateBadge({ value }: { value: string }) {
  const g = GENERIC[value] ?? { label: value, cls: "badge" };
  return <span className={g.cls}>{g.label}</span>;
}
