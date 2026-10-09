import Link from "next/link";
import { PROPERTY_TYPES } from "@/lib/catalog/definitions";
import type { CatalogListing } from "@/lib/catalog/types";
import { formatNumber } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { PlaceholderArt } from "./PlaceholderArt";
import { PriceLine } from "./Price";

export function listingHref(l: Pick<CatalogListing, "code" | "slug">, back?: string) {
  const path = `/inmuebles/${l.code.toLowerCase()}${l.slug ? `-${l.slug}` : ""}`;
  return back ? `${path}?volver=${encodeURIComponent(back)}` : path;
}

export function ListingCard({ l, operation, back }: { l: CatalogListing; operation?: "venta" | "renta"; back?: string }) {
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
          <PlaceholderArt label={l.is_demo ? "Imagen de demostración" : "Sin foto disponible"} />
        )}
        <div className="badges">
          {l.is_demo ? <span className="badge badge-demo">Demostración</span> : null}
          <span className="badge badge-navy">{l.operation === "ambas" ? "Venta y renta" : l.operation === "venta" ? "Venta" : "Renta"}</span>
          {l.status === "reservado" ? <span className="badge badge-warning">Reservado</span> : null}
        </div>
      </div>
      <div className="card-body" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="xs muted">
          {PROPERTY_TYPES[l.property_type]} · Ref. {l.code}
        </span>
        <h3 className="card-title">{l.title}</h3>
        <span className="small muted" style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <Icon name="pin" size={14} />
          <span>{[l.sector, l.municipality, l.province].filter(Boolean).join(", ")}</span>
        </span>
        <div style={{ marginTop: "auto" }}>
          {showSale ? <PriceLine label={showRent ? "Venta" : undefined} amount={l.sale_price} currency={l.sale_currency} /> : null}
          {showRent ? <PriceLine label={showSale ? "Renta" : undefined} amount={l.rent_price} currency={l.rent_currency} period={l.rent_period} /> : null}
          <div className="listing-meta">
            {l.bedrooms !== null ? <span><Icon name="bed" size={14} /> {l.bedrooms} hab.</span> : null}
            {l.bathrooms !== null ? <span><Icon name="bath" size={14} /> {l.bathrooms} baños</span> : null}
            {l.parking_spaces !== null ? <span><Icon name="car" size={14} /> {l.parking_spaces} parq.</span> : null}
            {area ? <span><Icon name="area" size={14} /> {formatNumber(area)} m²</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
