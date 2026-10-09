import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PROPERTY_TYPES } from "@/lib/catalog/definitions";
import type { CatalogListing } from "@/lib/catalog/types";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { removeFavorite } from "./actions";

export const metadata: Metadata = { title: "Favoritos" };

type Row = Pick<CatalogListing, "id" | "code" | "slug" | "title" | "property_type" | "operation" | "sector" | "municipality" | "province" | "status"
  | "sale_price" | "sale_currency" | "rent_price" | "rent_currency" | "rent_period">;

export default async function Page() {
  const u = await requireUser("/panel/favoritos");
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
      <h1>Favoritos</h1>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus favoritos.</p> : null}
      {!error && !ids.length ? (
        <div className="card empty">
          <p>Aún no guardó inmuebles. Use «Guardar favorito» en la ficha de un inmueble.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary" href="/venta">Ver en venta</Link>
            <Link className="btn btn-outline" href="/renta">Ver en renta</Link>
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
                      {PROPERTY_TYPES[l.property_type] ?? l.property_type} · {[l.sector, l.municipality, l.province].filter(Boolean).join(", ")} · {l.code}
                    </div>
                    <div className="small">
                      {l.sale_currency ? <span>Venta: {formatMoney(l.sale_price, l.sale_currency)} </span> : null}
                      {l.rent_currency ? <span>Renta: {formatMoney(l.rent_price, l.rent_currency)}{l.rent_period ? ` / ${l.rent_period}` : ""}</span> : null}
                      {l.status === "reservado" ? <span className="badge badge-warning" style={{ marginLeft: 6 }}>Reservado</span> : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong>Inmueble ya no disponible</strong>
                    <div className="xs muted">Guardado el {formatDate(f.created_at)}</div>
                  </div>
                )}
                <form action={removeFavorite}>
                  <input type="hidden" name="property_id" value={f.property_id} />
                  <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Quitar de favoritos${l ? `: ${l.title}` : ""}`}>Quitar</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
