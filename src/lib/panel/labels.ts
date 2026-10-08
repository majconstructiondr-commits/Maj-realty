// Etiquetas en español para estados guardados en la base de datos.

export const APPOINTMENT_STATUSES: Record<string, string> = {
  solicitada: "Solicitada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistió",
};

export const APPOINTMENT_KINDS: Record<string, string> = {
  visita: "Visita",
  evaluacion: "Evaluación",
  visita_tecnica: "Visita técnica",
  reunion: "Reunión",
};

export const QUOTE_STATUSES: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Pendiente de respuesta",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
  anulada: "Anulada",
};

export const QUOTE_SERVICES: Record<string, string> = {
  remodelacion: "Remodelación",
  administracion: "Administración",
  legal: "Gestión legal",
  venta: "Venta",
  renta: "Renta",
  otro: "Otro",
};

export const QUOTE_EVENTS: Record<string, string> = {
  borrador: "Creada como borrador",
  enviada: "Enviada al cliente",
  aceptada: "Aceptada por el cliente",
  rechazada: "Rechazada por el cliente",
  vencida: "Vencida",
  anulada: "Anulada",
  nueva_version: "Nueva versión creada",
};

export const REQUEST_EVENT_KINDS: Record<string, string> = {
  creada: "Solicitud registrada",
  estado: "Cambio de estado",
  etapa: "Cambio de etapa",
  asignacion: "Asignación",
  nota_privada: "Nota interna",
  nota_cliente: "Comentario",
  archivo: "Archivo adjunto",
  proxima_accion: "Próxima acción",
};

export const CONTRACT_STATUSES: Record<string, string> = {
  borrador: "Borrador",
  activo: "Activo",
  suspendido: "Suspendido",
  terminado: "Terminado",
};

export const MOVEMENT_KINDS: Record<string, string> = {
  renta_cobrada: "Renta cobrada",
  gasto: "Gasto",
  mantenimiento: "Mantenimiento",
  comision: "Comisión",
  pago_al_propietario: "Pago al propietario",
  ajuste: "Ajuste",
};

export const MOVEMENT_STATUSES: Record<string, string> = {
  registrado: "Registrado",
  conciliado: "Conciliado",
  anulado: "Anulado",
};

export const TICKET_STATUSES: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

export const TICKET_PRIORITIES: Record<string, string> = {
  baja: "Baja",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const DOCUMENT_KINDS: Record<string, string> = {
  contrato: "Contrato",
  estado_cuenta: "Estado de cuenta",
  informe: "Informe",
  comprobante: "Comprobante",
  otro: "Otro",
};

/** Clase de insignia según el estado (verde, ámbar, rojo o neutro). */
export function statusBadge(status: string): string {
  if (["confirmada", "aceptada", "completada", "activo", "conciliado", "resuelto", "cerrada"].includes(status)) return "badge badge-success";
  if (["solicitada", "enviada", "recibida", "en_revision", "documentos_requeridos", "abierto", "en_proceso", "registrado", "cotizada"].includes(status))
    return "badge badge-warning";
  if (["cancelada", "rechazada", "vencida", "anulada", "anulado", "no_asistio", "suspendido", "terminado", "urgente"].includes(status)) return "badge badge-danger";
  return "badge";
}

/** Etiqueta con respaldo legible para valores desconocidos. */
export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "";
  return map[key] ?? key.replace(/_/g, " ");
}
