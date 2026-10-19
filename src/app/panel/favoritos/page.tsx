import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { CatalogListing } from "@/lib/catalog/types";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { removeFavorite } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.favorites.meta };
}

type Row = Pick<CatalogListing, "id" | "code" | "slug" | "title" | "property_type" | "operation" | "sector" | "municipality" | "province" | "status"
  | "sale_price" | "sale_currency" | "rent_price" | "rent_currency" | "rent_period">;

export default async function Page() {
  const u = await requireUser("/panel/favoritos");
  const { d } = await getI18n();
  const t = d.panel.favorites;
  const supabase = await createClient();
  const { data: favs, error } = await supabase.from("favorites").select("property_id, created_at").eq("user_id", u.id).order("created_at", { ascending: false });
  const ids = (favs ?? []).map((f) => f.property_id as string);
  const { data: rows } = ids.length
    ? await supabase.from("catalog")
        .select("id, code, slug, title, property_type, operation, sector, municipality, province, status, sale_price, sale_currency, rent_price, rent_currency, rent_period")
        .in("id", ids)
    : { data: [] };
  const map = new Map(((rows ?? []) as Row[]).map((r) => [r.id, r]));

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && !ids.length ? (
        <div className="card empty">
          <p>{t.empty}</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/venta">{t.viewSale}</Link>
            <Link className="btn btn-outline" href="/renta">{t.viewRent}</Link>
          </div>
        </div>
      ) : null}
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {(favs ?? []).map((f) => {
          const l = map.get(f.property_id as string);
          return (
            <li key={f.property_id} className="card card-body">
              <div className="row-between">
                {l ? (
                  <div style={{ minWidth: 0 }}>
                    <Link href={listingHref(l)} style={{ fontWeight: 700 }}>{l.title}</Link>
                    <div className="small muted">
                      {d.labels.propertyTypes[l.property_type] ?? l.property_type} · {[l.sector, l.municipality, l.province].filter(Boolean).join(", ")} · {l.code}
                    </div>
                    <div className="small">
                      {l.sale_currency ? <span>{t.sale} {formatMoney(l.sale_price, l.sale_currency, { onRequest: d.common.priceOnRequest })} </span> : null}
                      {l.rent_currency ? <span>{t.rent} {formatMoney(l.rent_price, l.rent_currency, { onRequest: d.common.priceOnRequest })}{l.rent_period ? ` / ${d.labels.rentPeriods[l.rent_period] ?? l.rent_period}` : ""}</span> : null}
                      {l.status === "reservado" ? <span className="badge badge-warning" style={{ marginLeft: 6 }}>{t.reserved}</span> : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong>{t.unavailable}</strong>
                    <div className="xs muted">{fmt(t.savedOn, { date: formatDate(f.created_at) })}</div>
                  </div>
                )}
                <form action={removeFavorite}>
                  <input type="hidden" name="property_id" value={f.property_id} />
                  <button type="submit" className="btn btn-ghost btn-sm" aria-label={`${t.removeAria}${l ? `: ${l.title}` : ""}`}>{d.panel.shared.remove}</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
