import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination, SortTh } from "@/components/admin/Bits";
import { QUOTE_SERVICES, QUOTE_STATUSES, labelOf } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, sortOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/cotizaciones";
const SORTS = ["created_at", "updated_at", "valid_until", "number"] as const;

type Row = { id: string; number: string; title: string; client_name: string; service: string; status: string; currency: Currency; valid_until: string | null; created_at: string; is_demo: boolean; request_id: string | null };

export default async function AdminQuotes(props: PageProps<"/admin/cotizaciones">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.quotes;
  const status = oneOf(sp, "status", Object.keys(QUOTE_STATUSES));
  const service = oneOf(sp, "service", Object.keys(QUOTE_SERVICES));
  const currency = oneOf(sp, "moneda", ["DOP", "USD"]);
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  const sort = sortOf(sp, SORTS, "created_at");
  let q = supabase.from("quotes").select("id, number, title, client_name, service, status, currency, valid_until, created_at, is_demo, request_id", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (service) q = q.eq("service", service);
  if (currency) q = q.eq("currency", currency);
  if (term) q = q.or(`number.ilike.%${term}%,title.ilike.%${term}%,client_name.ilike.%${term}%`);
  const { data, count, error } = await q.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to);
  const rows = (data ?? []) as Row[];
  const { data: totals } = rows.length ? await supabase.from("quote_totals").select("quote_id, total").in("quote_id", rows.map((r) => r.id)) : { data: [] };
  const totalOf = new Map(((totals ?? []) as { quote_id: string; total: number }[]).map((x) => [x.quote_id, x.total]));

  return (
    <>
      <PageHeader title={t.title}><Link className="btn btn-primary btn-sm" href={`${BASE}/nueva`}>{t.new}</Link></PageHeader>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="c-q">{c.search}</label><input id="c-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder={t.searchPlaceholder} /></div>
        <div className="field"><label htmlFor="c-s">{c.status}</label><select id="c-s" name="status" className="select" defaultValue={status}><Options map={i.status.quote} empty={c.all} /></select></div>
        <div className="field"><label htmlFor="c-v">{t.service}</label><select id="c-v" name="service" className="select" defaultValue={service}><Options map={i.status.quoteServices} empty={c.all} /></select></div>
        <div className="field"><label htmlFor="c-m">{c.currencyLabel}</label><select id="c-m" name="moneda" className="select" defaultValue={currency}><option value="">{c.allF}</option><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
        <input type="hidden" name="orden" value={sort.raw} />
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>
      {error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <SortTh base={BASE} sp={sp} column="number" current={sort.raw}>{c.number}</SortTh>
              <th>{t.titleClient}</th><th>{t.service}</th><th>{c.status}</th><th>{c.total}</th>
              <SortTh base={BASE} sp={sp} column="valid_until" current={sort.raw}>{t.validity}</SortTh>
              <SortTh base={BASE} sp={sp} column="created_at" current={sort.raw}>{t.created}</SortTh>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`${BASE}/${r.id}`}><strong>{r.number}</strong></Link>{r.is_demo && <> <span className="badge badge-demo">Demo</span></>}</td>
                  <td>{r.title}<div className="xs muted">{r.client_name}</div></td>
                  <td className="small">{labelOf(i.status.quoteServices, r.service)}</td>
                  <td><Badge value={r.status} map={i.status.quote} /></td>
                  <td className="small">{formatMoney(totalOf.get(r.id) ?? 0, r.currency, { decimals: true })}</td>
                  <td className="small">{formatDate(r.valid_until)}</td>
                  <td className="small">{formatDate(r.created_at)}</td>
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
