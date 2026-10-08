// Catálogos usados en formularios, filtros y fichas. Las claves coinciden con la base de datos.

export const OPERATIONS = { venta: "Venta", renta: "Renta", ambas: "Venta y renta" } as const;
export type Operation = keyof typeof OPERATIONS;

export const PROPERTY_TYPES = {
  apartamento: "Apartamento",
  casa: "Casa",
  villa: "Villa",
  solar: "Solar / terreno",
  local: "Local comercial",
  oficina: "Oficina",
  nave: "Nave industrial",
  finca: "Finca",
  edificio: "Edificio",
  proyecto: "Proyecto",
} as const;
export type PropertyType = keyof typeof PROPERTY_TYPES;

export const CONDITIONS = {
  nuevo: "Nuevo",
  usado: "Usado",
  remodelado: "Remodelado",
  en_construccion: "En construcción",
} as const;

export const STATUSES = {
  borrador: "Borrador",
  en_revision: "En revisión",
  publicado: "Publicado",
  pausado: "Pausado",
  reservado: "Reservado",
  vendido: "Vendido",
  rentado: "Rentado",
  rechazado: "Rechazado",
  archivado: "Archivado",
} as const;
export type ListingStatus = keyof typeof STATUSES;

export const RENT_PERIODS = { mensual: "mensual", diario: "diario", semanal: "semanal", anual: "anual" } as const;

export const TRI = { si: "Sí", no: "No", desconocido: "Desconocido", no_aplica: "No aplica" } as const;
export type Tri = keyof typeof TRI;

/** Campos numéricos de distribución; cada uno puede ser cero, desconocido (vacío) o "no aplica". */
export const NUMERIC_FIELDS = {
  built_area_m2: { label: "Construcción", unit: "m²" },
  land_area_m2: { label: "Terreno", unit: "m²" },
  bedrooms: { label: "Habitaciones", unit: "" },
  bathrooms: { label: "Baños completos", unit: "" },
  half_bathrooms: { label: "Medios baños", unit: "" },
  parking_spaces: { label: "Parqueos", unit: "" },
  floor_number: { label: "Piso", unit: "" },
  levels: { label: "Niveles", unit: "" },
  year_built: { label: "Año de construcción", unit: "" },
} as const;
export type NumericField = keyof typeof NUMERIC_FIELDS;

export const SPACE_FIELDS = {
  service_room: "Cuarto de servicio",
  service_bathroom: "Baño de servicio",
  laundry_area: "Área de lavado",
  balcony: "Balcón",
  terrace: "Terraza",
  patio: "Patio",
  roof_area: "Área de techo",
} as const;
export type SpaceField = keyof typeof SPACE_FIELDS;

/** Campos que no aplican por tipo (no se exigen ni se muestran). */
export const NOT_APPLICABLE_BY_TYPE: Partial<Record<PropertyType, (NumericField | SpaceField)[]>> = {
  solar: ["built_area_m2", "bedrooms", "bathrooms", "half_bathrooms", "floor_number", "levels", "year_built",
    "service_room", "service_bathroom", "laundry_area", "balcony", "terrace", "roof_area"],
  finca: ["floor_number"],
  nave: ["bedrooms", "service_room", "service_bathroom", "balcony"],
  local: ["bedrooms", "service_room"],
  oficina: ["bedrooms", "service_room"],
  casa: ["floor_number"],
  villa: ["floor_number"],
};

export function fieldApplies(type: PropertyType, field: NumericField | SpaceField) {
  return !(NOT_APPLICABLE_BY_TYPE[type] ?? []).includes(field);
}

export type FeatureScope = "inmueble" | "residencial";
export type FeatureDef = { label: string; scope: FeatureScope; detail?: string };

export const FEATURES: Record<string, FeatureDef> = {
  ascensor: { label: "Ascensor", scope: "residencial" },
  planta_electrica: { label: "Planta eléctrica", scope: "residencial", detail: "Cobertura (total, áreas comunes, parcial)" },
  inversor: { label: "Inversor", scope: "inmueble" },
  cisterna: { label: "Cisterna", scope: "residencial" },
  tinaco: { label: "Tinaco", scope: "inmueble" },
  agua: { label: "Servicio de agua", scope: "inmueble", detail: "Fuente o frecuencia" },
  gas_comun: { label: "Gas común", scope: "residencial" },
  seguridad: { label: "Seguridad", scope: "residencial", detail: "Tipo y horario" },
  acceso_controlado: { label: "Acceso controlado", scope: "residencial" },
  camaras: { label: "Cámaras", scope: "residencial" },
  piscina: { label: "Piscina", scope: "residencial" },
  gimnasio: { label: "Gimnasio", scope: "residencial" },
  area_social: { label: "Área social", scope: "residencial" },
  amueblado: { label: "Amueblado", scope: "inmueble", detail: "Total o parcial" },
  aire_acondicionado: { label: "Aire acondicionado", scope: "inmueble", detail: "Áreas o unidades" },
  accesibilidad: { label: "Accesibilidad", scope: "residencial", detail: "Rampas, ascensor, puertas anchas" },
  mascotas: { label: "Se permiten mascotas", scope: "residencial", detail: "Condiciones" },
};

export const PUBLIC_STATUSES: ListingStatus[] = ["publicado", "reservado"];

export const PROVINCES = [
  "Distrito Nacional", "Santo Domingo", "Santiago", "La Altagracia", "Puerto Plata", "La Romana", "San Pedro de Macorís",
  "Samaná", "La Vega", "San Cristóbal", "Espaillat", "Duarte", "Peravia", "Azua", "Barahona", "Monseñor Nouel",
  "Sánchez Ramírez", "María Trinidad Sánchez", "Hermanas Mirabal", "Valverde", "Monte Plata", "Hato Mayor", "El Seibo",
  "San Juan", "Monte Cristi", "Dajabón", "Santiago Rodríguez", "Elías Piña", "Bahoruco", "Independencia", "Pedernales",
  "San José de Ocoa",
] as const;

export const REQUEST_KINDS = {
  contacto: "Contacto",
  info_inmueble: "Información de inmueble",
  visita: "Visita",
  venta_captacion: "Vender mi inmueble",
  renta_publicar: "Rentar mi inmueble",
  administracion: "Administración",
  remodelacion: "Remodelación",
  cotizacion: "Cotización",
  legal: "Gestión legal",
  busco_propiedad: "Busco una propiedad",
  publicar_propiedad: "Publicar propiedad",
  reporte: "Reporte",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;

export const REQUEST_STATUSES = {
  recibida: "Recibida",
  en_revision: "En revisión",
  documentos_requeridos: "Documentos requeridos",
  cotizada: "Cotizada",
  aprobada: "Aprobada",
  en_proceso: "En proceso",
  completada: "Completada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
} as const;

export const CRM_STAGES = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  visita: "Visita",
  propuesta: "Propuesta",
  cierre: "Cierre",
  descartado: "Descartado",
} as const;

export const CHANNELS = { whatsapp: "WhatsApp", llamada: "Llamada", correo: "Correo", chat: "Chat de la página" } as const;
