// Etiquetas de estados y catálogos definidos en código (lib/admin/labels.ts, lib/panel/labels.ts y
// lib/catalog/definitions.ts). Las claves coinciden con la base de datos; en español se toman de esas constantes.
import * as A from "@/lib/admin/labels";
import * as P from "@/lib/panel/labels";

type L = Record<string, string>;
const of = (o: L): L => ({ ...o });

const es = {
  listing: of(A.STATUSES),
  requestKinds: of(A.REQUEST_KINDS),
  requestStatuses: of(A.REQUEST_STATUSES),
  crmStages: of(A.CRM_STAGES),
  license: of(A.LICENSE_STATUSES),
  payment: of(A.PAYMENT_STATUSES),
  paymentMethods: of(A.PAYMENT_METHODS),
  application: of(A.APPLICATION_STATUSES),
  applicantTypes: of(A.APPLICANT_TYPES),
  org: of(A.ORG_STATUSES),
  quote: of(A.QUOTE_STATUSES),
  quoteServices: of(A.QUOTE_SERVICES),
  appointment: of(A.APPOINTMENT_STATUSES),
  appointmentKinds: of(A.APPOINTMENT_KINDS),
  contract: of(A.CONTRACT_STATUSES),
  movementKinds: of(A.MOVEMENT_KINDS),
  movementStatuses: of(A.MOVEMENT_STATUSES),
  ticketPriorities: of(A.TICKET_PRIORITIES),
  ticketStatuses: of(A.TICKET_STATUSES),
  mgmtDocKinds: of(A.MGMT_DOC_KINDS),
  mgmtServices: of(A.MGMT_SERVICES),
  docTypes: of(A.DOC_TYPES),
  docReview: of(A.DOC_REVIEW),
  reportReasons: of(A.REPORT_REASONS),
  propertyReports: of(A.PROPERTY_REPORT_STATUSES),
  messageReports: of(A.MESSAGE_REPORT_STATUSES),
  conversations: of(A.CONVERSATION_STATUSES),
  roles: of(A.ROLES),
  requestEvents: of(A.REQUEST_EVENT_KINDS),
  detailLabels: of(A.DETAIL_LABELS),
  // Vista del cliente (/panel): algunos textos difieren de los del personal.
  clientQuote: of(P.QUOTE_STATUSES),
  quoteEvents: of(P.QUOTE_EVENTS),
  clientRequestEvents: of(P.REQUEST_EVENT_KINDS),
  documentKinds: of(P.DOCUMENT_KINDS),
  // Cuotas de renta (rent_charges.status).
  rentCharges: { pendiente: "Pendiente", en_revision: "Pago en revisión", pagado: "Cobrada", anulado: "Anulada" } as L,
};

export type StatusDict = typeof es;

const en: StatusDict = {
  listing: {
    borrador: "Draft", en_revision: "In review", publicado: "Published", pausado: "Paused", reservado: "Reserved",
    vendido: "Sold", rentado: "Rented", rechazado: "Rejected", archivado: "Archived",
  },
  requestKinds: {
    contacto: "Contact", info_inmueble: "Property information", visita: "Visit", venta_captacion: "Sell my property",
    renta_publicar: "Rent out my property", administracion: "Management", remodelacion: "Remodeling", cotizacion: "Quote",
    legal: "Legal service", busco_propiedad: "Looking for a property", publicar_propiedad: "List a property", reporte: "Report",
  },
  requestStatuses: {
    recibida: "Received", en_revision: "In review", documentos_requeridos: "Documents required", cotizada: "Quoted",
    aprobada: "Approved", en_proceso: "In progress", completada: "Completed", cerrada: "Closed", cancelada: "Cancelled",
  },
  crmStages: { nuevo: "New", contactado: "Contacted", visita: "Visit", propuesta: "Proposal", cierre: "Closing", descartado: "Discarded" },
  license: { pendiente: "Pending", activa: "Active", vencida: "Expired", suspendida: "Suspended", cancelada: "Cancelled" },
  payment: { pendiente: "Pending", aprobado: "Approved", rechazado: "Rejected" },
  paymentMethods: { transferencia: "Bank transfer", deposito: "Deposit", efectivo: "Cash", otro: "Other" },
  application: { pendiente: "Pending", documentos_requeridos: "Documents required", aprobada: "Approved", rechazada: "Rejected" },
  applicantTypes: { propietario: "Owner", vendedor: "Independent seller", agencia: "Agency" },
  org: { pendiente: "Pending", activa: "Active", suspendida: "Suspended" },
  quote: { borrador: "Draft", enviada: "Sent", aceptada: "Accepted", rechazada: "Rejected", vencida: "Expired", anulada: "Voided" },
  quoteServices: {
    remodelacion: "Remodeling", administracion: "Management", legal: "Legal service", venta: "Sale", renta: "Rent", otro: "Other",
  },
  appointment: { solicitada: "Requested", confirmada: "Confirmed", cancelada: "Cancelled", completada: "Completed", no_asistio: "No-show" },
  appointmentKinds: { visita: "Visit", evaluacion: "Assessment", visita_tecnica: "Technical visit", reunion: "Meeting" },
  contract: { borrador: "Draft", activo: "Active", suspendido: "Suspended", terminado: "Terminated" },
  movementKinds: {
    renta_cobrada: "Rent collected", gasto: "Expense", mantenimiento: "Maintenance", comision: "Commission",
    pago_al_propietario: "Payment to owner", ajuste: "Adjustment",
  },
  movementStatuses: { registrado: "Recorded", conciliado: "Reconciled", anulado: "Voided" },
  ticketPriorities: { baja: "Low", normal: "Normal", alta: "High", urgente: "Urgent" },
  ticketStatuses: { abierto: "Open", en_proceso: "In progress", resuelto: "Resolved", cerrado: "Closed" },
  mgmtDocKinds: { contrato: "Contract", estado_cuenta: "Account statement", informe: "Report", comprobante: "Receipt", otro: "Other" },
  mgmtServices: {
    cobro_rentas: "Rent collection", mantenimiento: "Maintenance", busqueda_inquilinos: "Tenant search",
    contratos: "Contracts", informes: "Reports", pagos_servicios: "Utility payments",
  },
  docTypes: {
    autorizacion_publicacion: "Listing authorization", identificacion_propietario: "Owner identification",
    titulo: "Certificate of title", certificacion_estado_juridico: "Legal status certification",
    plano_catastral: "Cadastral map", deslinde: "Boundary survey", impuestos: "Taxes", contrato: "Contract",
    poder_representacion: "Power of attorney", otro: "Other",
  },
  docReview: { pendiente: "Pending", revisado: "Reviewed", observado: "Flagged" },
  reportReasons: {
    informacion_falsa: "False information", no_disponible: "Not available", precio_incorrecto: "Wrong price",
    fraude: "Possible fraud", contenido_inapropiado: "Inappropriate content", duplicado: "Duplicate", otro: "Other",
  },
  propertyReports: { abierto: "Open", en_revision: "In review", resuelto: "Resolved", descartado: "Dismissed" },
  messageReports: { abierto: "Open", resuelto: "Resolved", descartado: "Dismissed" },
  conversations: { abierta: "Open", cerrada: "Closed", bloqueada: "Blocked" },
  roles: { cliente: "Client", propietario: "Owner", vendedor: "Seller", agencia: "Agency", staff: "MAJ staff", admin: "Administrator" },
  requestEvents: {
    creada: "Request created", estado: "Status", etapa: "Stage", asignacion: "Assignment", nota_privada: "Private note",
    nota_cliente: "Note visible to client", archivo: "File", proxima_accion: "Next action",
  },
  detailLabels: {
    asunto: "Subject", fecha_preferida: "Preferred date", tipo: "Property type", provincia: "Province", municipio: "Municipality",
    sector: "Sector", precio_esperado: "Expected price", moneda: "Currency", autorizado: "States they are authorized",
    visita_evaluacion: "Wants an assessment visit", preferencias: "Preferences", renta_esperada: "Expected rent", amueblado: "Furnished",
    disponible_desde: "Available from", unidades: "Units", ocupacion: "Occupancy", servicios: "Requested services",
    situacion_actual: "Current situation", tipo_trabajo: "Type of work", area_m2: "Area (m²)", alcance: "Scope",
    presupuesto: "Budget", fecha_deseada: "Desired date", urgencia: "Urgency", visita_tecnica: "Wants a technical visit",
    servicio: "Service", referencia_inmueble: "Property reference", service_code: "Legal service", service_codes: "Legal services", descripcion: "Description",
    operacion: "Transaction", zonas: "Areas", presupuesto_max: "Maximum budget", habitaciones: "Bedrooms", fecha: "Date",
    tipo_publicador: "Publisher type",
    cobro_rentas: "Rent collection", mantenimiento: "Maintenance", busqueda_inquilinos: "Tenant search",
    contratos: "Contracts", informes: "Reports", pagos_servicios: "Utility payments",
  },
  clientQuote: {
    borrador: "Draft", enviada: "Awaiting your response", aceptada: "Accepted", rechazada: "Rejected", vencida: "Expired", anulada: "Voided",
  },
  quoteEvents: {
    borrador: "Created as draft", enviada: "Sent to client", aceptada: "Accepted by client", rechazada: "Rejected by client",
    vencida: "Expired", anulada: "Voided", nueva_version: "New version created",
  },
  clientRequestEvents: {
    creada: "Request registered", estado: "Status change", etapa: "Stage change", asignacion: "Assignment",
    nota_privada: "Internal note", nota_cliente: "Comment", archivo: "Attached file", proxima_accion: "Next action",
  },
  documentKinds: { contrato: "Contract", estado_cuenta: "Account statement", informe: "Report", comprobante: "Receipt", otro: "Other" },
  rentCharges: { pendiente: "Pending", en_revision: "Payment in review", pagado: "Collected", anulado: "Voided" },
};

export const status = { es, en };
