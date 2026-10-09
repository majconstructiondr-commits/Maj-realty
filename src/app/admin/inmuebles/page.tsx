import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, Options, PageHeader, Pagination, SortTh } from "@/components/admin/Bits";
import { OPERATIONS, PROPERTY_TYPES, STATUSES, labelOf } from "@/lib/admin/labels";
import { hrefWith, ilikeTerm, oneOf, pageOf, sortOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createMajListing } from "./actions";

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
      <PageHeader title="Inmuebles y revisión">
        <Link className="btn btn-primary btn-sm" href="/admin/inmuebles/importar">Importar desde Excel</Link>
        <a className="btn btn-ghost btn-sm" href={exportHref}>Exportar CSV</a>
      </PageHeader>

      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>Crear publicación propia de MAJ</strong></summary>
        <p className="small muted">Se crea como borrador a nombre de su usuario, marcada como publicación de MAJ (no consume licencia). Luego complete la ficha en el editor.</p>
        <ActionForm action={createMajListing} submit="Crear borrador y abrir editor">
          <div className="form-grid">
            <div className="field"><label htmlFor="n-title" className="required">Título</label><input id="n-title" name="title" className="input" minLength={5} maxLength={140} required /></div>
            <div className="field"><label htmlFor="n-op" className="required">Operación</label><select id="n-op" name="operation" className="select" required><Options map={OPERATIONS} /></select></div>
            <div className="field"><label htmlFor="n-type" className="required">Tipo</label><select id="n-type" name="property_type" className="select" required><Options map={PROPERTY_TYPES} /></select></div>
          </div>
        </ActionForm>
      </details>

      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="f-q">Buscar</label><input id="f-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder="Código, título, sector…" /></div>
        <div className="field"><label htmlFor="f-status">Estado</label><select id="f-status" name="status" className="select" defaultValue={status}><Options map={STATUSES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="f-op">Operación</label><select id="f-op" name="operation" className="select" defaultValue={operation}><Options map={OPERATIONS} empty="Todas" /></select></div>
        <div className="field"><label htmlFor="f-type">Tipo</label><select id="f-type" name="property_type" className="select" defaultValue={type}><Options map={PROPERTY_TYPES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="f-maj">Origen</label><select id="f-maj" name="maj" className="select" defaultValue={maj}><option value="">Todos</option><option value="1">Publicaciones MAJ</option><option value="0">Terceros</option></select></div>
        <div className="field">
          <span className="label">Pendientes</span>
          <label className="check"><input type="checkbox" name="cambios" value="1" defaultChecked={cambios} /> Con cambios por revisar</label>
          <label className="check"><input type="checkbox" name="multimedia" value="1" defaultChecked={multimedia} /> Con multimedia por aprobar</label>
        </div>
        <input type="hidden" name="orden" value={sort.raw} />
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>

      {error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay inmuebles con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortTh base={BASE} sp={sp} column="code" current={sort.raw}>Código</SortTh>
                <SortTh base={BASE} sp={sp} column="title" current={sort.raw}>Título</SortTh>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Precio</th>
                <th>Titular</th>
                <SortTh base={BASE} sp={sp} column="submitted_at" current={sort.raw}>Enviado</SortTh>
                <SortTh base={BASE} sp={sp} column="updated_at" current={sort.raw}>Actualizado</SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`${BASE}/${r.id}`}><strong>{r.code}</strong></Link></td>
                  <td>
                    {r.title}
                    <div className="xs muted">{labelOf(OPERATIONS, r.operation)} · {labelOf(PROPERTY_TYPES, r.property_type)}</div>
                    <div className="row" style={{ gap: 4 }}>
                      {r.is_maj_listing && <span className="badge badge-navy">MAJ</span>}
                      {r.is_demo && <span className="badge badge-demo">Demo</span>}
                      {r.documents_reviewed_at && <span className="badge badge-success">Docs revisados</span>}
                    </div>
                  </td>
                  <td><Badge value={r.status} map={STATUSES} /></td>
                  <td className="small">{[r.sector, r.municipality, r.province].filter(Boolean).join(", ") || "—"}</td>
                  <td className="small">
                    {r.property_prices.length === 0 ? "—" : r.property_prices.map((p) => (
                      <div key={p.operation}>{p.operation === "venta" ? "Venta" : "Renta"}: {formatMoney(p.amount, p.currency)}</div>
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
