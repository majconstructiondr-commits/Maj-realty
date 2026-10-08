import type { Currency } from "../format";
import type { ListingStatus, Operation, PropertyType, Tri } from "./definitions";

export type FeatureValue = { v: Tri; d?: string };

/** Fila del catálogo público (vista public.catalog): solo campos públicos. */
export type CatalogListing = {
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
  updated_at: string;
  published_at: string | null;
  is_demo: boolean;
  is_maj_listing: boolean;
  country: string;
  province: string;
  municipality: string;
  sector: string;
  approx_lat: string | null;
  approx_lng: string | null;
  public_address: string | null;
  built_area_m2: string | null;
  land_area_m2: string | null;
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
  features: Record<string, FeatureValue>;
  condo_rules: string | null;
  restrictions: string | null;
  documents_reviewed_at: string | null;
  documents_review_scope: string | null;
  sale_price: string | null;
  sale_currency: Currency | null;
  sale_negotiable: boolean | null;
  rent_price: string | null;
  rent_currency: Currency | null;
  rent_negotiable: boolean | null;
  rent_period: string | null;
  cover_path: string | null;
  cover_alt: string | null;
  advisor_name: string | null;
  advisor_whatsapp: string | null;
  photo_count: number;
  /** URL firmada temporal de la portada (se calcula en servidor) */
  cover_url?: string | null;
};

export type CatalogPrice = {
  property_id: string;
  operation: "venta" | "renta";
  amount: string | null;
  currency: Currency;
  negotiable: boolean;
  maintenance_amount: string | null;
  maintenance_currency: Currency | null;
  maintenance_included: Tri;
  additional_costs: string | null;
  rent_period: string | null;
  deposit_amount: string | null;
  deposit_months: string | null;
  advance_months: string | null;
  min_term_months: number | null;
  delivery_conditions: string | null;
};

export type CatalogMedia = {
  id: string;
  property_id: string;
  kind: "foto" | "video" | "recorrido" | "plano";
  storage_path: string | null;
  external_url: string | null;
  alt_text: string;
  sort_order: number;
  is_cover: boolean;
  url?: string | null;
};
