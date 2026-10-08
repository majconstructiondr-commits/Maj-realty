import Link from "next/link";
import { searchCatalog } from "@/lib/catalog/data";
import { toQueryString, type SearchFilters } from "@/lib/catalog/search";
import { getSiteSettings } from "@/lib/site";
import { fillTemplate } from "@/lib/whatsapp";
import { Filters } from "./Filters";
import { ListingCard } from "./ListingCard";
import { WhatsAppLink } from "../ui/WhatsAppLink";
import { CatalogMap } from "./CatalogMap";

export async function CatalogPage({ operation, f }: { operation: "venta" | "renta"; f: SearchFilters }) {
  const base = `/${operation}`;
  const [res, s] = await Promise.all([searchCatalog(operation, f), getSiteSettings()]);
  const here = `${base}${toQueryString(f)}`;
  const title = operation === "venta" ? "Inmuebles en venta" : "Inmuebles en renta";
  return (
    <div className="container section-sm">
      <nav aria-label="Ruta" className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/">Inicio</Link> / <span aria-current="page">{operation === "venta" ? "Venta" : "Renta"}</span>
      </nav>
      <h1>{title}</h1>
      {res.demo ? <p className="alert alert-warning small">Modo demostración: estos inmuebles son ejemplos y no están disponibles.</p> : null}
      <div className="catalog-layout" style={{ marginTop: 16 }}>
        <aside>
          <Filters f={f} action={base} />
        </aside>
        <section aria-labelledby="resultados">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 id="resultados" className="small" style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", margin: 0 }} aria-live="polite">
              {res.total === 1 ? "1 inmueble" : `${res.total} inmuebles`}
            </h2>
            <div className="row" style={{ gap: 8 }}>
              <nav aria-label="Ordenar" className="row" style={{ gap: 6 }}>
                {([
                  ["recientes", "Recientes"],
                  ["precio_asc", "Precio ↑"],
                  ["precio_desc", "Precio ↓"],
                ] as const).map(([k, label]) => (
                  <Link key={k} className="tab" aria-current={f.orden === k ? "true" : undefined} href={`${base}${toQueryString(f, { orden: k, pagina: 1 })}`}>
                    {label}
                  </Link>
                ))}
              </nav>
              <nav aria-label="Vista" className="row" style={{ gap: 6 }}>
                {([
                  ["tarjetas", "Tarjetas"],
                  ["lista", "Lista"],
                  ["mapa", "Mapa"],
                ] as const).map(([k, label]) => (
                  <Link key={k} className="tab" aria-current={f.vista === k ? "true" : undefined} href={`${base}${toQueryString(f, { vista: k })}`}>
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          {f.orden !== "recientes" && !f.moneda ? (
            <p className="xs muted">Al ordenar por precio se agrupan por moneda (RD$ y US$ no se mezclan). Filtra por moneda para comparar.</p>
          ) : null}

          <p className="xs">
            <Link href={`/panel/busquedas?guardar=${encodeURIComponent(here)}`}>Guardar esta búsqueda</Link>
          </p>

          {res.error ? <p className="alert alert-error" role="alert">{res.error}</p> : null}

          {res.items.length === 0 && !res.error ? (
            <div className="card empty">
              <h3>No encontramos inmuebles con esos filtros</h3>
              <p>Prueba con menos filtros o déjanos tus criterios: te contactamos cuando tengamos opciones.</p>
              <div className="row" style={{ justifyContent: "center" }}>
                <Link className="btn btn-primary" href={`/busco-propiedad?operacion=${operation}`}>Busco una propiedad</Link>
                <WhatsAppLink
                  number={s["whatsapp.primary"]}
                  text={fillTemplate(s["whatsapp.template"], { servicio: `un inmueble en ${operation}` })}
                  label="Preguntar por WhatsApp"
                />
                <Link className="btn btn-ghost" href={base}>Quitar filtros</Link>
              </div>
            </div>
          ) : f.vista === "mapa" ? (
            <CatalogMap items={res.items} back={here} />
          ) : (
            <div className={f.vista === "lista" ? "grid listing-list" : "grid-3"} style={f.vista === "tarjetas" ? { gridTemplateColumns: undefined } : undefined}>
              {res.items.map((l) => (
                <ListingCard key={l.id} l={l} operation={operation} back={here} />
              ))}
            </div>
          )}

          {res.pages > 1 ? (
            <nav className="pagination" aria-label="Paginación">
              {f.pagina > 1 ? <Link href={`${base}${toQueryString(f, { pagina: f.pagina - 1 })}`} rel="prev">‹ Anterior</Link> : null}
              {Array.from({ length: res.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === res.pages || Math.abs(p - f.pagina) <= 2)
                .map((p) =>
                  p === f.pagina ? (
                    <span key={p} aria-current="page">{p}</span>
                  ) : (
                    <Link key={p} href={`${base}${toQueryString(f, { pagina: p })}`}>{p}</Link>
                  ),
                )}
              {f.pagina < res.pages ? <Link href={`${base}${toQueryString(f, { pagina: f.pagina + 1 })}`} rel="next">Siguiente ›</Link> : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
