// Etiquetas en español para estados y catálogos usados en el panel MAJ.
export {
  REQUEST_KINDS, REQUEST_STATUSES, CRM_STAGES, STATUSES, PROPERTY_TYPES, OPERATIONS, CHANNELS,
} from "@/lib/catalog/definitions";

export const LICENSE_STATUSES = {
  pendiente: "Pendiente", activa: "Activa", vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada",
} as const;
export const PAYMENT_STATUSES = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" } as const;
export const PAYMENT_METHODS = { transferencia: "Transferencia", deposito: "Depósito", efectivo: "Efectivo", otro: "Otro" } as const;
export const APPLICATION_STATUSES = {
  pendiente: "Pendiente", documentos_requeridos: "Documentos requeridos", aprobada: "Aprobada", rechazada: "Rechazada",
} as const;
export const APPLICANT_TYPES = { propietario: "Propietario", vendedor: "Vendedor independiente", agencia: "Agencia" } as const;
export const ORG_STATUSES = { pendiente: "Pendiente", activa: "Activa", suspendida: "Suspendida" } as const;
export const QUOTE_STATUSES = {
  borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida", anulada: "Anulada",
} as const;
export const QUOTE_SERVICES = {
  remodelacion: "Remodelación", administracion: "Administración", legal: "Gestión legal", venta: "Venta", renta: "Renta", otro: "Otro",
} as const;
export const APPOINTMENT_STATUSES = {
  solicitada: "Solicitada", confirmada: "Confirmada", cancelada: "Cancelada", completada: "Completada", no_asistio: "No asistió",
} as const;
export const APPOINTMENT_KINDS = { visita: "Visita", evaluacion: "Evaluación", visita_tecnica: "Visita técnica", reunion: "Reunión" } as const;
export const CONTRACT_STATUSES = { borrador: "Borrador", activo: "Activo", suspendido: "Suspendido", terminado: "Terminado" } as const;
export const MOVEMENT_KINDS = {
  renta_cobrada: "Renta cobrada", gasto: "Gasto", mantenimiento: "Mantenimiento", comision: "Comisión",
  pago_al_propietario: "Pago al propietario", ajuste: "Ajuste",
} as const;
export const MOVEMENT_STATUSES = { registrado: "Registrado", conciliado: "Conciliado", anulado: "Anulado" } as const;
export const TICKET_PRIORITIES = { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" } as const;
export const TICKET_STATUSES = { abierto: "Abierto", en_proceso: "En proceso", resuelto: "Resuelto", cerrado: "Cerrado" } as const;
export const MGMT_DOC_KINDS = {
  contrato: "Contrato", estado_cuenta: "Estado de cuenta", informe: "Informe", comprobante: "Comprobante", otro: "Otro",
} as const;
export const MGMT_SERVICES = {
  cobro_rentas: "Cobro de rentas", mantenimiento: "Mantenimiento", busqueda_inquilinos: "Búsqueda de inquilinos",
  contratos: "Contratos", informes: "Informes", pagos_servicios: "Pago de servicios",
} as const;
export const DOC_TYPES = {
  autorizacion_publicacion: "Autorización de publicación", identificacion_propietario: "Identificación del propietario",
  titulo: "Certificado de título", certificacion_estado_juridico: "Certificación del estado jurídico",
  plano_catastral: "Plano catastral", deslinde: "Deslinde", impuestos: "Impuestos", contrato: "Contrato",
  poder_representacion: "Poder de representación", otro: "Otro",
} as const;
export const DOC_REVIEW = { pendiente: "Pendiente", revisado: "Revisado", observado: "Observado" } as const;
export const REPORT_REASONS = {
  informacion_falsa: "Información falsa", no_disponible: "No disponible", precio_incorrecto: "Precio incorrecto",
  fraude: "Posible fraude", contenido_inapropiado: "Contenido inapropiado", duplicado: "Duplicado", otro: "Otro",
} as const;
export const PROPERTY_REPORT_STATUSES = { abierto: "Abierto", en_revision: "En revisión", resuelto: "Resuelto", descartado: "Descartado" } as const;
export const MESSAGE_REPORT_STATUSES = { abierto: "Abierto", resuelto: "Resuelto", descartado: "Descartado" } as const;
export const CONVERSATION_STATUSES = { abierta: "Abierta", cerrada: "Cerrada", bloqueada: "Bloqueada" } as const;
export const ROLES = {
  cliente: "Cliente", propietario: "Propietario", vendedor: "Vendedor", agencia: "Agencia", staff: "Personal MAJ", admin: "Administrador",
} as const;
export const REQUEST_EVENT_KINDS = {
  creada: "Solicitud creada", estado: "Estado", etapa: "Etapa", asignacion: "Asignación", nota_privada: "Nota privada",
  nota_cliente: "Nota visible al cliente", archivo: "Archivo", proxima_accion: "Próxima acción",
} as const;

export type Tone = "success" | "danger" | "warning" | "gold" | "navy" | "neutral";

const TONES: Record<string, Tone> = {
  publicado: "success", activa: "success", activo: "success", aprobado: "success", aprobada: "success", aceptada: "success",
  confirmada: "success", conciliado: "success", completada: "success", resuelto: "success", revisado: "success", cierre: "success",
  vendido: "navy", rentado: "navy", enviada: "navy", cerrada: "neutral", terminado: "neutral", archivado: "neutral",
  en_revision: "warning", pendiente: "warning", solicitada: "warning", documentos_requeridos: "warning", nuevo: "warning",
  abierto: "warning", observado: "warning", borrador: "neutral", registrado: "neutral", reservado: "gold", pausado: "gold",
  rechazado: "danger", rechazada: "danger", cancelada: "danger", anulada: "danger", anulado: "danger", suspendida: "danger",
  suspendido: "danger", vencida: "danger", no_asistio: "danger", descartado: "neutral", bloqueada: "danger", urgente: "danger",
  alta: "warning",
};

export function toneOf(value: string | null | undefined): Tone {
  return (value && TONES[value]) || "neutral";
}

export function labelOf(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "—";
  return map[value] ?? value.replace(/_/g, " ");
}

/** Claves de details (jsonb) de solicitudes → etiqueta legible. */
export const DETAIL_LABELS: Record<string, string> = {
  asunto: "Asunto", fecha_preferida: "Fecha preferida", tipo: "Tipo de inmueble", provincia: "Provincia", municipio: "Municipio",
  sector: "Sector", precio_esperado: "Precio esperado", moneda: "Moneda", autorizado: "Declara estar autorizado",
  visita_evaluacion: "Desea visita de evaluación", preferencias: "Preferencias", renta_esperada: "Renta esperada", amueblado: "Amueblado",
  disponible_desde: "Disponible desde", unidades: "Unidades", ocupacion: "Ocupación", servicios: "Servicios solicitados",
  situacion_actual: "Situación actual", tipo_trabajo: "Tipo de trabajo", area_m2: "Área (m²)", alcance: "Alcance",
  presupuesto: "Presupuesto", fecha_deseada: "Fecha deseada", urgencia: "Urgencia", visita_tecnica: "Desea visita técnica",
  servicio: "Servicio", referencia_inmueble: "Referencia del inmueble", service_code: "Servicio legal", service_codes: "Servicios legales", descripcion: "Descripción",
  operacion: "Operación", zonas: "Zonas", presupuesto_max: "Presupuesto máximo", habitaciones: "Habitaciones", fecha: "Fecha",
  tipo_publicador: "Tipo de publicador",
  cobro_rentas: "Cobro de rentas", mantenimiento: "Mantenimiento", busqueda_inquilinos: "Búsqueda de inquilinos",
  contratos: "Contratos", informes: "Informes", pagos_servicios: "Pago de servicios",
};
