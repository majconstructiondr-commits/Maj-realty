// Enlace de propiedades (feed XML) en el formato de catálogo de inmuebles de Meta (Facebook e Instagram).
// Solo usa campos del catálogo público; nunca datos privados del dueño ni del título.
import type { CatalogListing } from "./types";
import type { PropertyType } from "./definitions";

export type FeedListing = Pick<
  CatalogListing,
  | "id" | "code" | "title" | "description" | "operation" | "property_type" | "province" | "municipality" | "sector"
  | "approx_lat" | "approx_lng" | "public_address" | "bedrooms" | "bathrooms" | "built_area_m2" | "land_area_m2"
  | "year_built" | "sale_price" | "sale_currency" | "rent_price" | "rent_currency"
> & { url: string; images: string[] };

const META_TYPES: Partial<Record<PropertyType, string>> = {
  apartamento: "apartment",
  casa: "house",
  villa: "house",
  solar: "land",
  finca: "land",
};

export function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

// Quita caracteres de control que invalidan el XML.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

function tag(name: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${xmlEscape(clean(String(value)))}</${name}>`;
}

/** Una entrada por operación con precio: "ambas" genera venta y renta. Sin precio no se envía (Meta lo exige). */
function entries(l: FeedListing) {
  const out: { id: string; availability: string; listingType: string; price: string }[] = [];
  const wantsSale = l.operation === "venta" || l.operation === "ambas";
  const wantsRent = l.operation === "renta" || l.operation === "ambas";
  if (wantsSale && l.sale_price && l.sale_currency)
    out.push({ id: wantsRent ? `${l.code}-V` : l.code, availability: "for_sale", listingType: "for_sale_by_agent", price: `${Number(l.sale_price)} ${l.sale_currency}` });
  if (wantsRent && l.rent_price && l.rent_currency)
    out.push({ id: wantsSale ? `${l.code}-R` : l.code, availability: "for_rent", listingType: "for_rent_by_agent", price: `${Number(l.rent_price)} ${l.rent_currency}` });
  return out;
}

export function buildMetaFeed(listings: FeedListing[], opts: { title: string; selfUrl: string }) {
  const items: string[] = [];
  for (const l of listings) {
    if (!l.images.length) continue; // Meta exige al menos una foto
    for (const e of entries(l)) {
      const area = l.built_area_m2 ?? l.land_area_m2;
      items.push(
        [
          "<listing>",
          tag("home_listing_id", e.id),
          tag("name", l.title),
          tag("availability", e.availability),
          tag("listing_type", e.listingType),
          tag("description", l.description.slice(0, 5000)),
          '<address format="simple">',
          l.public_address ? `<component name="addr1">${xmlEscape(clean(l.public_address))}</component>` : "",
          `<component name="city">${xmlEscape(clean(l.municipality || l.province))}</component>`,
          `<component name="region">${xmlEscape(clean(l.province))}</component>`,
          `<component name="country">Dominican Republic</component>`,
          "</address>",
          tag("neighborhood", l.sector),
          tag("latitude", l.approx_lat),
          tag("longitude", l.approx_lng),
          ...l.images.slice(0, 20).map((u) => `<image><url>${xmlEscape(u)}</url></image>`),
          tag("num_beds", l.bedrooms),
          tag("num_baths", l.bathrooms),
          tag("price", e.price),
          tag("property_type", META_TYPES[l.property_type] ?? "other"),
          area ? `<area_size>${Number(area)}</area_size><area_unit>sq_m</area_unit>` : "",
          tag("year_built", l.year_built),
          tag("url", l.url),
          "</listing>",
        ].join(""),
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<listings>${tag("title", opts.title)}<link rel="self" href="${xmlEscape(opts.selfUrl)}"/>\n${items.join("\n")}\n</listings>\n`;
}
