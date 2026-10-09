import type { ListingStatus, Operation, PropertyType, Tri } from "@/lib/catalog/definitions";
import type { Currency } from "@/lib/format";
import type { ChangeSet, DocType, FeatureMap } from "./schemas";

/** Fila completa de public.properties visible para el titular. */
export type EditorProperty = {
  id: string;
  code: string;
  slug: string;
  title: string;
  operation: Operation;
  property_type: PropertyType;
  description: string;
  condition: string | null;
  status: ListingStatus;
  available_from: string | null;
  owner_user_id: string;
  organization_id: string | null;
  license_id: string | null;
  province: string;
  municipality: string;
  sector: string;
  approx_lat: string | number | null;
  approx_lng: string | number | null;
  exact_address_public: boolean;
  public_address: string | null;
  built_area_m2: string | number | null;
  land_area_m2: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_bathrooms: number | null;
  parking_spaces: number | null;
  floor_number: number | null;
  levels: number | null;
  year_built: number | null;
  service_room: Tri;
  service_bathroom: Tri;
  laundry_area: Tri;
  balcony: Tri;
  terrace: Tri;
  patio: Tri;
  roof_area: Tri;
  roof_use_detail: string | null;
  na_fields: string[];
  features: FeatureMap;
  condo_rules: string | null;
  restrictions: string | null;
  rejection_reason: string | null;
  pause_reason: string | null;
  submitted_at: string | null;
  published_at: string | null;
  first_published_at: string | null;
  documents_reviewed_at: string | null;
  documents_review_scope: string | null;
  created_at: string;
  updated_at: string;
};

export type EditorPrivate = {
  property_id: string;
  street: string | null;
  street_number: string | null;
  building: string | null;
  unit: string | null;
  exact_lat: string | number | null;
  exact_lng: string | number | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_id_type: string | null;
  owner_id_number: string | null;
  publisher_relationship: string | null;
  publication_authorized: boolean;
  authorization_date: string | null;
  authorization_expires: string | null;
  commission_terms: string | null;
  exclusivity: boolean | null;
  exclusivity_expires: string | null;
  title_type: string | null;
  title_registry_number: string | null;
  cadastral_designation: string | null;
  survey_status: string | null;
  legal_status_certificate_date: string | null;
  declared_liens: string | null;
  tax_notes: string | null;
  contract_notes: string | null;
};

export type EditorPrice = {
  id?: string;
  property_id?: string;
  operation: "venta" | "renta";
  amount: string | number | null;
  currency: Currency;
  negotiable: boolean;
  maintenance_amount: string | number | null;
  maintenance_currency: Currency | null;
  maintenance_included: Tri;
  additional_costs: string | null;
  rent_period: string | null;
  deposit_amount: string | number | null;
  deposit_months: string | number | null;
  advance_months: string | number | null;
  min_term_months: number | null;
  delivery_conditions: string | null;
};

export type EditorMedia = {
  id: string;
  kind: "foto" | "video" | "recorrido" | "plano";
  storage_path: string | null;
  external_url: string | null;
  alt_text: string;
  sort_order: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  approved: boolean;
  created_at: string;
  /** URL firmada temporal (servidor) */
  url?: string | null;
};

export type EditorDocument = {
  id: string;
  doc_type: DocType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  review_status: "pendiente" | "revisado" | "observado";
  review_notes: string | null;
  created_at: string;
};

export type ChangeRequest = {
  id: string;
  status: "pendiente" | "aprobado" | "rechazado" | "retirado";
  changes: ChangeSet;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};
