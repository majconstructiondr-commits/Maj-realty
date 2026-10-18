import Link from "next/link";
import { searchCatalog } from "@/lib/catalog/data";
import { toQueryString, type SearchFilters } from "@/lib/catalog/search";
import { getSiteSettings } from "@/lib/site";
import { fillTemplate } from "@/lib/whatsapp";
import { Filters } from "./Filters";
import { ListingCard } from "./ListingCard";
import { WhatsAppLink } from "../ui/WhatsAppLink";
import { CatalogMap } from "./CatalogMap";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n";

export async function CatalogPage({ operation, f }: { operation: "venta" | "renta"; f: SearchFilters }) {
  const base = `/${operation}`;
  const [res, s, { d }] = await Promise.all([searchCatalog(operation, f), getSiteSettings(), getI18n()]);
  const c = d.catalog;
  const here = `${base}${toQueryString(f)}`;
  const title = operation === "venta" ? c.titleSale : c.titleRent;
  return (
    <div className="container section-sm">
      <nav aria-label={d.common.breadcrumb} className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/">{d.nav.home}</Link> / <span aria-current="page">{operation === "venta" ? d.nav.sale : d.nav.rent}</span>
      </nav>
      <h1>{title}</h1>
      {res.demo ? <p className="alert alert-warning small">{c.demoNotice}</p> : null}
      <div className="catalog-layout" style={{ marginTop: 16 }}>
        <aside>
          <Filters f={f} action={base} d={d} />
        </aside>
        <section aria-labelledby="resultados">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 id="resultados" className="small" style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", margin: 0 }} aria-live="polite">
              {res.total === 1 ? c.countOne : fmt(c.countMany, { n: res.total })}
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <nav aria-label={c.sortAria} className="row" style={{ gap: 6 }}>
                {(["recientes", "precio_asc", "precio_desc"] as const).map((k) => (

                  <Link key={k} className="tab" aria-current={f.orden === k ? "true" : undefined} href={`${base}${toQueryString(f, { orden: k, pagina: 1 })}`}>
                    {c.sort[k]}
                  </Link>
                ))}
              </nav>
              <nav aria-label={c.viewAria} className="row" style={{ gap: 6 }}>
                {(["tarjetas", "lista", "mapa"] as const).map((k) => (
                  <Link key={k} className="tab" aria-current={f.vista === k ? "true" : undefined} href={`${base}${toQueryString(f, { vista: k })}`}>
                    {c.view[k]}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          {f.orden !== "recientes" && !f.moneda ? (
            <p className="xs muted">{c.currencyGrouping}</p>
          ) : null}

          <p className="xs">
            <Link href={`/panel/busquedas?guardar=${encodeURIComponent(here)}`}>{c.saveSearch}</Link>
          </p>

          {res.error ? <p className="alert alert-error" role="alert">{c.loadError}</p> : null}

          {res.items.length === 0 && !res.error ? (
            <div className="card empty">
              <h3>{c.emptyTitle}</h3>
              <p>{c.emptyText}</p>
              <div className="row" style={{ justifyContent: "center" }}>
                <Link className="btn btn-primary" href={`/busco-propiedad?operacion=${operation}`}>{d.common.lookingForProperty}</Link>
                <WhatsAppLink
                  number={s["whatsapp.primary"]}
                  text={fillTemplate(s["whatsapp.template"], { servicio: `un inmueble en ${operation}` })}
                  label={d.whatsapp.askCatalog}
                />
                <Link className="btn btn-ghost" href={base}>{c.removeFilters}</Link>
              </div>
            </div>
          ) : f.vista === "mapa" ? (
            <CatalogMap items={res.items} back={here} />
          ) : (
            <div className={f.vista === "lista" ? "grid listing-list" : "grid-3"} style={f.vista === "tarjetas" ? { gridTemplateColumns: undefined } : undefined}>
              {res.items.map((l) => (
                <ListingCard key={l.id} l={l} operation={operation} back={here} d={d} />
              ))}
            </div>
          )}

          {res.pages > 1 ? (
            <nav className="pagination" aria-label={c.pagination}>
              {f.pagina > 1 ? <Link href={`${base}${toQueryString(f, { pagina: f.pagina - 1 })}`} rel="prev">{c.prev}</Link> : null}
              {Array.from({ length: res.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === res.pages || Math.abs(p - f.pagina) <= 2)
                .map((p) =>
                  p === f.pagina ? (
                    <span key={p} aria-current="page">{p}</span>
                  ) : (
                    <Link key={p} href={`${base}${toQueryString(f, { pagina: p })}`}>{p}</Link>
                  ),
                )}
              {f.pagina < res.pages ? <Link href={`${base}${toQueryString(f, { pagina: f.pagina + 1 })}`} rel="next">{c.next}</Link> : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
