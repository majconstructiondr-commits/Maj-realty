import Link from "next/link";
import type { CatalogListing } from "@/lib/catalog/types";
import { formatNumber } from "@/lib/format";
import { es, type Dictionary } from "@/i18n/es";
import { Icon } from "../ui/Icon";
import { PlaceholderArt } from "./PlaceholderArt";
import { PriceLine } from "./Price";
import { listingHref } from "./href";

export { listingHref } from "./href";

/** `d` es el diccionario del idioma activo en las páginas públicas; el panel usa el español por defecto. */
export function ListingCard({ l, operation, back, d = es }: { l: CatalogListing; operation?: "venta" | "renta"; back?: string; d?: Dictionary }) {
  const c = d.card;
  const showSale = operation !== "renta" && l.sale_currency;
  const showRent = operation !== "venta" && l.rent_currency;
  const area = l.built_area_m2 ?? l.land_area_m2;
  return (
    <Link href={listingHref(l, back)} className="card listing-card">
      <div className="listing-media">
        {l.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.cover_url} alt={l.cover_alt || l.title} loading="lazy" />
        ) : (
          <PlaceholderArt label={l.is_demo ? c.demoImage : c.noPhoto} />
        )}
        <div className="badges">
          {l.is_demo ? <span className="badge badge-demo">{d.common.demo}</span> : null}
          <span className="badge badge-navy">{d.labels.operations[l.operation]}</span>
          {l.status === "reservado" ? <span className="badge badge-warning">{c.reserved}</span> : null}
        </div>
      </div>
      <div className="card-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="xs muted">
          {d.labels.propertyTypes[l.property_type]} · {c.ref} {l.code}
        </span>
        <h3 className="card-title">{l.title}</h3>
        <span className="small muted" style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <Icon name="pin" size={14} />
          <span>{[l.sector, l.municipality, l.province].filter(Boolean).join(", ")}</span>
        </span>
        <div style={{ marginTop: "auto" }}>
          {showSale ? <PriceLine label={showRent ? d.labels.operations.venta : undefined} amount={l.sale_price} currency={l.sale_currency} d={d} /> : null}
          {showRent ? <PriceLine label={showSale ? d.labels.operations.renta : undefined} amount={l.rent_price} currency={l.rent_currency} period={l.rent_period} d={d} /> : null}
          <div className="listing-meta">
            {l.bedrooms !== null ? <span><Icon name="bed" size={14} /> {l.bedrooms} {c.bedrooms}</span> : null}
            {l.bathrooms !== null ? <span><Icon name="bath" size={14} /> {l.bathrooms} {c.bathrooms}</span> : null}
            {l.parking_spaces !== null ? <span><Icon name="car" size={14} /> {l.parking_spaces} {c.parking}</span> : null}
            {area ? <span><Icon name="area" size={14} /> {formatNumber(area)} m²</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
