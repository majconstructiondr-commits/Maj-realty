import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { describeSavedSearch, parseCatalogPath, savedSearchHref, type SavedSearchQuery } from "@/lib/panel/saved-search";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { deleteSavedSearch } from "./actions";
import { SaveSearchForm } from "./SaveSearchForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.searches.meta };
}

export default async function Page(props: PageProps<"/panel/busquedas">) {
  const sp = await props.searchParams;
  const rawPath = Array.isArray(sp.guardar) ? sp.guardar[0] : sp.guardar;
  const toSave = parseCatalogPath(rawPath);
  const u = await requireUser(`/panel/busquedas${rawPath ? `?guardar=${encodeURIComponent(rawPath)}` : ""}`);
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.searches;
  const { data, error } = await supabase.from("saved_searches").select("id, name, query, notify, created_at").eq("user_id", u.id).order("created_at", { ascending: false });

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      {toSave ? (
        <section className="card card-body" aria-labelledby="ss-new">
          <h2 id="ss-new" style={{ marginTop: 0 }}>{t.saveTitle[toSave.operation]}</h2>
          <SaveSearchForm
            path={`/${toSave.operation}${toSave.qs ? `?${toSave.qs}` : ""}`}
            summary={describeSavedSearch(toSave, t)}
            defaultName={t.defaultName[toSave.operation]}
          />
        </section>
      ) : (
        <p className="small muted">
          {t.howTo} <Link href="/venta">{t.sale}</Link> {t.or} <Link href="/renta">{t.rent}</Link> {t.howToAfter}
        </p>
      )}
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && !data?.length ? <div className="card empty"><p>{t.empty}</p></div> : null}
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
                    {href ? `${q.operation === "venta" ? t.sale : t.rent} · ${describeSavedSearch(q, t)}` : t.invalid}
                  </div>
                  <div className="xs muted">{fmt(t.savedOn, { date: formatDate(s.created_at) })}{s.notify ? t.notifyOn : ""}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {href ? <Link className="btn btn-outline btn-sm" href={href}>{t.viewResults}</Link> : null}
                  <form action={deleteSavedSearch}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="btn btn-ghost btn-sm" aria-label={fmt(t.deleteAria, { name: s.name })}>{d.panel.shared.delete}</button>
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
