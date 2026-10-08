// Acciones rápidas permitidas al titular (reflejan las transiciones de public.properties_guard).
import type { ListingStatus } from "@/lib/catalog/definitions";

export const QUICK_ACTIONS = {
  enviar: { label: "Enviar a revisión", from: ["borrador", "rechazado"], to: "en_revision" },
  reenviar: { label: "Reenviar a revisión", from: ["pausado"], to: "en_revision" },
  retirar: { label: "Retirar de revisión", from: ["en_revision"], to: "borrador" },
  volver_borrador: { label: "Volver a borrador", from: ["rechazado"], to: "borrador" },
  pausar: { label: "Pausar", from: ["publicado"], to: "pausado" },
  reservar: { label: "Marcar reservado", from: ["publicado"], to: "reservado" },
  quitar_reserva: { label: "Quitar reserva", from: ["reservado"], to: "publicado" },
  vendido: { label: "Marcar vendido", from: ["publicado", "reservado"], to: "vendido" },
  rentado: { label: "Marcar rentado", from: ["publicado", "reservado"], to: "rentado" },
  archivar: { label: "Archivar", from: ["borrador", "rechazado", "pausado", "vendido", "rentado", "publicado"], to: "archivado" },
} as const satisfies Record<string, { label: string; from: ListingStatus[]; to: ListingStatus }>;
export type QuickAction = keyof typeof QUICK_ACTIONS;

/** Acciones disponibles según estado y operación (vendido solo con venta; rentado solo con renta). */
export function availableActions(status: ListingStatus, operation: "venta" | "renta" | "ambas"): QuickAction[] {
  return (Object.keys(QUICK_ACTIONS) as QuickAction[]).filter((k) => {
    if (!(QUICK_ACTIONS[k].from as readonly string[]).includes(status)) return false;
    if (k === "vendido" && operation === "renta") return false;
    if (k === "rentado" && operation === "venta") return false;
    return true;
  });
}

/** Columnas que se copian al duplicar (nunca multimedia, documentos, datos privados ni campos de revisión). */
export const DUPLICATE_COLUMNS = [
  "operation", "property_type", "description", "condition", "available_from", "organization_id", "country", "province",
  "municipality", "sector", "built_area_m2", "land_area_m2", "bedrooms", "bathrooms", "half_bathrooms", "parking_spaces",
  "floor_number", "levels", "year_built", "service_room", "service_bathroom", "laundry_area", "balcony", "terrace", "patio",
  "roof_area", "roof_use_detail", "na_fields", "features", "condo_rules", "restrictions",
] as const;

export function duplicateTitle(title: string) {
  const t = `Copia de ${title}`;
  return t.length > 140 ? t.slice(0, 140) : t;
}
