import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { describeSavedSearch, parseCatalogPath, savedSearchHref, type SavedSearchQuery } from "@/lib/panel/saved-search";
import { createClient } from "@/lib/supabase/server";
import { deleteSavedSearch } from "./actions";
import { SaveSearchForm } from "./SaveSearchForm";

export const metadata: Metadata = { title: "Búsquedas guardadas" };

export default async function Page(props: PageProps<"/panel/busquedas">) {
  const sp = await props.searchParams;
  const rawPath = Array.isArray(sp.guardar) ? sp.guardar[0] : sp.guardar;
  const toSave = parseCatalogPath(rawPath);
  const u = await requireUser(`/panel/busquedas${rawPath ? `?guardar=${encodeURIComponent(rawPath)}` : ""}`);
  const supabase = await createClient();
  const { data, error } = await supabase.from("saved_searches").select("id, name, query, notify, created_at").eq("user_id", u.id).order("created_at", { ascending: false });

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Búsquedas guardadas</h1>
      {toSave ? (
        <section className="card card-body" aria-labelledby="ss-new">
          <h2 id="ss-new" style={{ marginTop: 0 }}>Guardar esta búsqueda de {toSave.operation}</h2>
          <SaveSearchForm
            path={`/${toSave.operation}${toSave.qs ? `?${toSave.qs}` : ""}`}
            summary={describeSavedSearch(toSave)}
            defaultName={`Inmuebles en ${toSave.operation}`}
          />
        </section>
      ) : (
        <p className="small muted">
          Para guardar una búsqueda, aplique filtros en <Link href="/venta">Venta</Link> o <Link href="/renta">Renta</Link> y use «Guardar búsqueda».
        </p>
      )}
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus búsquedas.</p> : null}
      {!error && !data?.length ? <div className="card empty"><p>No tiene búsquedas guardadas.</p></div> : null}
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {(data ?? []).map((s) => {
          const href = savedSearchHref(s.query);
          const q = s.query as SavedSearchQuery;
          return (
            <li key={s.id} className="card card-body">
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  {href ? <Link href={href} style={{ fontWeight: 700 }}>{s.name}</Link> : <strong>{s.name}</strong>}
                  <div className="small muted">
                    {href ? `${q.operation === "venta" ? "Venta" : "Renta"} · ${describeSavedSearch(q)}` : "Búsqueda no válida"}
                  </div>
                  <div className="xs muted">Guardada el {formatDate(s.created_at)}{s.notify ? " · Avisos activados" : ""}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {href ? <Link className="btn btn-outline btn-sm" href={href}>Ver resultados</Link> : null}
                  <form action={deleteSavedSearch}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Eliminar búsqueda ${s.name}`}>Eliminar</button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
