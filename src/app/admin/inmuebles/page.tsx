import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, Options, PageHeader, Pagination, SortTh } from "@/components/admin/Bits";
import { OPERATIONS, PROPERTY_TYPES, STATUSES, labelOf } from "@/lib/admin/labels";
import { hrefWith, ilikeTerm, oneOf, pageOf, sortOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createMajListing } from "./actions";
import { getI18n } from "@/i18n/server";
import { env } from "@/lib/env";

const BASE = "/admin/inmuebles";
const SORTS = ["updated_at", "created_at", "submitted_at", "code", "title"] as const;

type Row = {
  id: string; code: string; title: string; status: string; operation: string; property_type: string; province: string;
  municipality: string; sector: string; owner_user_id: string; is_maj_listing: boolean; is_demo: boolean; updated_at: string;
  submitted_at: string | null; documents_reviewed_at: string | null;
  property_prices: { operation: string; amount: number | null; currency: Currency }[];
};

export default async function AdminProperties(props: PageProps<"/admin/inmuebles">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.listings;
  const status = oneOf(sp, "status", Object.keys(STATUSES));
  const operation = oneOf(sp, "operation", Object.keys(OPERATIONS));
  const type = oneOf(sp, "property_type", Object.keys(PROPERTY_TYPES));
  const term = ilikeTerm(str(sp, "q"));
  const maj = str(sp, "maj");
  const cambios = str(sp, "cambios") === "1";
  const multimedia = str(sp, "multimedia") === "1";
  const { page, pageSize, from, to } = pageOf(sp);
  const sort = sortOf(sp, SORTS, "updated_at");

  let idFilter: string[] | null = null;
  if (cambios) {
    const { data } = await supabase.from("property_change_requests").select("property_id").eq("status", "pendiente").limit(300);
    idFilter = (data ?? []).map((r) => r.property_id as string);
  }
  if (multimedia) {
    const { data } = await supabase.from("property_media").select("property_id").eq("approved", false).limit(1000);
    const ids = [...new Set((data ?? []).map((r) => r.property_id as string))].slice(0, 300);
    idFilter = idFilter ? idFilter.filter((x) => ids.includes(x)) : ids;
  }

  let q = supabase
    .from("properties")
    .select("id, code, title, status, operation, property_type, province, municipality, sector, owner_user_id, is_maj_listing, is_demo, updated_at, submitted_at, documents_reviewed_at, property_prices(operation, amount, currency)", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (operation) q = q.eq("operation", operation);
  if (type) q = q.eq("property_type", type);
  if (maj === "1") q = q.eq("is_maj_listing", true);
  if (maj === "0") q = q.eq("is_maj_listing", false);
  if (str(sp, "demo") === "1") q = q.eq("is_demo", true);
  if (term) q = q.or(`code.ilike.%${term}%,title.ilike.%${term}%,sector.ilike.%${term}%,municipality.ilike.%${term}%`);
  if (idFilter) q = q.in("id", idFilter.length ? idFilter : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count, error } = await q.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to);
  const rows = (data ?? []) as unknown as Row[];
  const owners = await userLabels(supabase, rows.map((r) => r.owner_user_id));
  const exportHref = hrefWith("/api/admin/export/inmuebles", sp, { pagina: undefined, orden: undefined });

  return (
    <>
      <PageHeader title={t.title}>
        <Link className="btn btn-primary btn-sm" href="/panel/publicaciones/nueva">{t.new}</Link>
        <Link className="btn btn-outline btn-sm" href="/admin/inmuebles/importar">{t.import}</Link>
        <a className="btn btn-ghost btn-sm" href={exportHref}>{c.exportCsv}</a>
      </PageHeader>

      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>{t.feedTitle}</strong></summary>
        <p className="small muted">{t.feedNote}</p>
        <input className="input" readOnly value={`${env.siteUrl}/feeds/facebook.xml`} aria-label={t.feedLabel} />
      </details>

      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>{t.createMaj}</strong></summary>
        <p className="small muted">{t.createMajNote}</p>
        <ActionForm action={createMajListing} submit={t.createSubmit}>
          <div className="form-grid">
            <div className="field"><label htmlFor="n-title" className="required">{c.titleField}</label><input id="n-title" name="title" className="input" minLength={5} maxLength={140} required /></div>
            <div className="field"><label htmlFor="n-op" className="required">{c.operation}</label><select id="n-op" name="operation" className="select" required><Options map={i.labels.operations} /></select></div>
            <div className="field"><label htmlFor="n-type" className="required">{c.kind}</label><select id="n-type" name="property_type" className="select" required><Options map={i.labels.propertyTypes} /></select></div>
          </div>
        </ActionForm>
      </details>

      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="f-q">{c.search}</label><input id="f-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder={t.searchPlaceholder} /></div>
        <div className="field"><label htmlFor="f-status">{c.status}</label><select id="f-status" name="status" className="select" defaultValue={status}><Options map={i.status.listing} empty={c.all} /></select></div>
        <div className="field"><label htmlFor="f-op">{c.operation}</label><select id="f-op" name="operation" className="select" defaultValue={operation}><Options map={i.labels.operations} empty={c.allF} /></select></div>
        <div className="field"><label htmlFor="f-type">{c.kind}</label><select id="f-type" name="property_type" className="select" defaultValue={type}><Options map={i.labels.propertyTypes} empty={c.all} /></select></div>
        <div className="field"><label htmlFor="f-maj">{t.origin}</label><select id="f-maj" name="maj" className="select" defaultValue={maj}><option value="">{c.all}</option><option value="1">{t.majListings}</option><option value="0">{t.thirdParty}</option></select></div>
        <div className="field">
          <span className="label">{t.pendingLabel}</span>
          <label className="check"><input type="checkbox" name="cambios" value="1" defaultChecked={cambios} /> {t.withChanges}</label>
          <label className="check"><input type="checkbox" name="multimedia" value="1" defaultChecked={multimedia} /> {t.withMedia}</label>
        </div>
        <input type="hidden" name="orden" value={sort.raw} />
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>

      {error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortTh base={BASE} sp={sp} column="code" current={sort.raw}>{c.code}</SortTh>
                <SortTh base={BASE} sp={sp} column="title" current={sort.raw}>{c.titleField}</SortTh>
                <th>{c.status}</th>
                <th>{c.location}</th>
                <th>{c.price}</th>
                <th>{t.owner}</th>
                <SortTh base={BASE} sp={sp} column="submitted_at" current={sort.raw}>{t.submitted}</SortTh>
                <SortTh base={BASE} sp={sp} column="updated_at" current={sort.raw}>{c.updated}</SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`${BASE}/${r.id}`}><strong>{r.code}</strong></Link></td>
                  <td>
                    {r.title}
                    <div className="xs muted">{labelOf(i.labels.operations, r.operation)} · {labelOf(i.labels.propertyTypes, r.property_type)}</div>
                    <div className="row" style={{ gap: 4 }}>
                      {r.is_maj_listing && <span className="badge badge-navy">MAJ</span>}
                      {r.is_demo && <span className="badge badge-demo">Demo</span>}
                      {r.documents_reviewed_at && <span className="badge badge-success">{t.docsReviewed}</span>}
                    </div>
                  </td>
                  <td><Badge value={r.status} map={i.status.listing} /></td>
                  <td className="small">{[r.sector, r.municipality, r.province].filter(Boolean).join(", ") || "—"}</td>
                  <td className="small">
                    {r.property_prices.length === 0 ? "—" : r.property_prices.map((p) => (
                      <div key={p.operation}>{labelOf(i.labels.operations, p.operation)}: {formatMoney(p.amount, p.currency)}</div>
                    ))}
                  </td>
                  <td className="small">{labelFor(owners, r.owner_user_id)}</td>
                  <td className="small">{formatDate(r.submitted_at)}</td>
                  <td className="small">{formatDate(r.updated_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
