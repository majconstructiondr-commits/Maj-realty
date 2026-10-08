import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination, SortTh } from "@/components/admin/Bits";
import { QUOTE_SERVICES, QUOTE_STATUSES, labelOf } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, sortOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate, formatMoney, type Currency } from "@/lib/format";

const BASE = "/admin/cotizaciones";
const SORTS = ["created_at", "updated_at", "valid_until", "number"] as const;

type Row = { id: string; number: string; title: string; client_name: string; service: string; status: string; currency: Currency; valid_until: string | null; created_at: string; is_demo: boolean; request_id: string | null };

export default async function AdminQuotes(props: PageProps<"/admin/cotizaciones">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
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
  const totalOf = new Map(((totals ?? []) as { quote_id: string; total: number }[]).map((t) => [t.quote_id, t.total]));

  return (
    <>
      <PageHeader title="Cotizaciones"><Link className="btn btn-primary btn-sm" href={`${BASE}/nueva`}>Nueva cotización</Link></PageHeader>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="c-q">Buscar</label><input id="c-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder="Número, título o cliente" /></div>
        <div className="field"><label htmlFor="c-s">Estado</label><select id="c-s" name="status" className="select" defaultValue={status}><Options map={QUOTE_STATUSES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="c-v">Servicio</label><select id="c-v" name="service" className="select" defaultValue={service}><Options map={QUOTE_SERVICES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="c-m">Moneda</label><select id="c-m" name="moneda" className="select" defaultValue={currency}><option value="">Todas</option><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
        <input type="hidden" name="orden" value={sort.raw} />
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>
      {error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay cotizaciones.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <SortTh base={BASE} sp={sp} column="number" current={sort.raw}>Número</SortTh>
              <th>Título / cliente</th><th>Servicio</th><th>Estado</th><th>Total</th>
              <SortTh base={BASE} sp={sp} column="valid_until" current={sort.raw}>Vigencia</SortTh>
              <SortTh base={BASE} sp={sp} column="created_at" current={sort.raw}>Creada</SortTh>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`${BASE}/${r.id}`}><strong>{r.number}</strong></Link>{r.is_demo && <> <span className="badge badge-demo">Demo</span></>}</td>
                  <td>{r.title}<div className="xs muted">{r.client_name}</div></td>
                  <td className="small">{labelOf(QUOTE_SERVICES, r.service)}</td>
                  <td><Badge value={r.status} map={QUOTE_STATUSES} /></td>
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
