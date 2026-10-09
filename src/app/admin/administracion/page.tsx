import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, ExportLink, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { ContractFields } from "@/components/admin/ContractFields";
import { CONTRACT_STATUSES } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { localDay } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";
import { createContract } from "./actions";

const BASE = "/admin/administracion";
type Row = { id: string; property_label: string; location_summary: string | null; units: number; status: string; start_date: string; end_date: string | null; owner_user_id: string };

export default async function AdminManagement(props: PageProps<"/admin/administracion">) {
  const sp = (await props.searchParams) as SP;
  const { supabase, isAdmin } = await staffCtx(BASE);
  const status = oneOf(sp, "status", Object.keys(CONTRACT_STATUSES));
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  let q = supabase.from("management_contracts").select("id, property_label, location_summary, units, status, start_date, end_date, owner_user_id", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (term) q = q.or(`property_label.ilike.%${term}%,location_summary.ilike.%${term}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as Row[];
  const owners = await userLabels(supabase, rows.map((r) => r.owner_user_id));

  return (
    <>
      <PageHeader title="Administración de propiedades">
        <ExportLink href="/api/admin/export/movimientos">Exportar movimientos (CSV)</ExportLink>
      </PageHeader>
      <p className="small muted">Registro operativo de administración. No es banca ni contabilidad fiscal certificada. Los importes se muestran siempre por moneda.</p>
      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>Nuevo contrato de administración</strong></summary>
        {!isAdmin && <p className="alert alert-warning small">Al crear el contrato, un administrador debe otorgar el rol “propietario” para que el dueño acceda a su portal.</p>}
        <ActionForm action={createContract} submit="Crear contrato">
          <div className="field">
            <label htmlFor="c-oe" className="required">Correo del propietario (cuenta registrada)</label>
            <input id="c-oe" name="owner_email" type="email" className="input" required maxLength={160} />
          </div>
          {str(sp, "solicitud") && <input type="hidden" name="request_id" value={str(sp, "solicitud")} />}
          <ContractFields today={localDay(new Date())} />
        </ActionForm>
      </details>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="a-q">Buscar</label><input id="a-q" name="q" className="input" defaultValue={str(sp, "q")} /></div>
        <div className="field"><label htmlFor="a-s">Estado</label><select id="a-s" name="status" className="select" defaultValue={status}><Options map={CONTRACT_STATUSES} empty="Todos" /></select></div>
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>
      {error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay contratos.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Inmueble</th><th>Propietario</th><th>Unidades</th><th>Vigencia</th><th>Estado</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`${BASE}/${r.id}`}><strong>{r.property_label}</strong></Link><div className="xs muted">{r.location_summary}</div></td>
                <td className="small">{labelFor(owners, r.owner_user_id)}</td>
                <td>{r.units}</td>
                <td className="small">{formatDate(r.start_date)} – {r.end_date ? formatDate(r.end_date) : "indefinido"}</td>
                <td><Badge value={r.status} map={CONTRACT_STATUSES} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
