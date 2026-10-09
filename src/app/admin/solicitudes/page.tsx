import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination, SortTh } from "@/components/admin/Bits";
import { CRM_STAGES, REQUEST_KINDS, REQUEST_STATUSES, labelOf } from "@/lib/admin/labels";
import { hrefWith, ilikeTerm, isUuid, oneOf, pageOf, sortOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, staffMembers, userLabels } from "@/lib/admin/server";
import { addDays, localDayStartIso } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";

const BASE = "/admin/solicitudes";
const SORTS = ["created_at", "updated_at", "next_action_at", "number"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  id: string; number: string; kind: string; status: string; stage: string; contact_name: string; contact_email: string | null;
  contact_phone: string | null; assigned_to: string | null; next_action: string | null; next_action_at: string | null;
  created_at: string; property_ref: string | null; is_demo: boolean;
};

export default async function AdminRequests(props: PageProps<"/admin/solicitudes">) {
  const sp = (await props.searchParams) as SP;
  const { supabase, user } = await staffCtx(BASE);
  const kind = oneOf(sp, "kind", Object.keys(REQUEST_KINDS));
  const status = oneOf(sp, "status", Object.keys(REQUEST_STATUSES));
  const stage = oneOf(sp, "stage", Object.keys(CRM_STAGES));
  const asignado = str(sp, "asignado");
  const desde = DAY.test(str(sp, "desde")) ? str(sp, "desde") : "";
  const hasta = DAY.test(str(sp, "hasta")) ? str(sp, "hasta") : "";
  const abiertas = str(sp, "abiertas") === "1";
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  const sort = sortOf(sp, SORTS, "created_at");

  let q = supabase.from("service_requests")
    .select("id, number, kind, status, stage, contact_name, contact_email, contact_phone, assigned_to, next_action, next_action_at, created_at, property_ref, is_demo", { count: "exact" });
  if (kind) q = q.eq("kind", kind);
  if (status) q = q.eq("status", status);
  if (stage) q = q.eq("stage", stage);
  if (abiertas) q = q.not("status", "in", "(completada,cerrada,cancelada)");
  if (asignado === "ninguno") q = q.is("assigned_to", null);
  else if (asignado === "yo") q = q.eq("assigned_to", user.id);
  else if (isUuid(asignado)) q = q.eq("assigned_to", asignado);
  if (desde) q = q.gte("created_at", localDayStartIso(desde));
  if (hasta) q = q.lt("created_at", localDayStartIso(addDays(hasta, 1)));
  if (term) q = q.or(`number.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%,contact_phone.ilike.%${term}%,property_ref.ilike.%${term}%`);
  const [{ data, count, error }, staff] = await Promise.all([
    q.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(from, to),
    staffMembers(supabase),
  ]);
  const rows = (data ?? []) as Row[];
  const people = await userLabels(supabase, rows.map((r) => r.assigned_to));
  const exportHref = hrefWith("/api/admin/export/solicitudes", { ...sp, asignado: asignado === "yo" ? user.id : asignado }, { pagina: undefined, orden: undefined });

  return (
    <>
      <PageHeader title="Solicitudes y CRM">
        <a className="btn btn-ghost btn-sm" href={exportHref}>Exportar CSV</a>
      </PageHeader>
      <p className="small muted">El envío de comunicaciones comerciales no se hace desde aquí. Use solo los canales que el cliente autorizó para atender su solicitud.</p>

      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="f-q">Buscar</label><input id="f-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder="Número, nombre, correo, teléfono" /></div>
        <div className="field"><label htmlFor="f-kind">Tipo</label><select id="f-kind" name="kind" className="select" defaultValue={kind}><Options map={REQUEST_KINDS} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="f-status">Estado</label><select id="f-status" name="status" className="select" defaultValue={status}><Options map={REQUEST_STATUSES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="f-stage">Etapa</label><select id="f-stage" name="stage" className="select" defaultValue={stage}><Options map={CRM_STAGES} empty="Todas" /></select></div>
        <div className="field">
          <label htmlFor="f-as">Responsable</label>
          <select id="f-as" name="asignado" className="select" defaultValue={asignado}>
            <option value="">Todos</option><option value="yo">Asignadas a mí</option><option value="ninguno">Sin asignar</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="f-d">Desde</label><input id="f-d" type="date" name="desde" className="input" defaultValue={desde} /></div>
        <div className="field"><label htmlFor="f-h">Hasta</label><input id="f-h" type="date" name="hasta" className="input" defaultValue={hasta} /></div>
        <label className="check"><input type="checkbox" name="abiertas" value="1" defaultChecked={abiertas} /> Solo abiertas</label>
        <input type="hidden" name="orden" value={sort.raw} />
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>

      {error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay solicitudes con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <SortTh base={BASE} sp={sp} column="number" current={sort.raw}>Número</SortTh>
                <th>Tipo</th><th>Contacto</th><th>Estado</th><th>Etapa</th><th>Responsable</th>
                <SortTh base={BASE} sp={sp} column="next_action_at" current={sort.raw}>Próxima acción</SortTh>
                <SortTh base={BASE} sp={sp} column="created_at" current={sort.raw}>Recibida</SortTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`${BASE}/${r.id}`}><strong>{r.number}</strong></Link>{r.is_demo && <> <span className="badge badge-demo">Demo</span></>}</td>
                  <td className="small">{labelOf(REQUEST_KINDS, r.kind)}{r.property_ref && <div className="xs muted">{r.property_ref}</div>}</td>
                  <td className="small">{r.contact_name}<div className="xs muted">{r.contact_email ?? r.contact_phone}</div></td>
                  <td><Badge value={r.status} map={REQUEST_STATUSES} /></td>
                  <td><Badge value={r.stage} map={CRM_STAGES} /></td>
                  <td className="small">{r.assigned_to ? labelFor(people, r.assigned_to) : <span className="badge badge-warning">Sin asignar</span>}</td>
                  <td className="small">{r.next_action ?? "—"}{r.next_action_at && <div className="xs muted">{formatDate(r.next_action_at, true)}</div>}</td>
                  <td className="small">{formatDate(r.created_at, true)}</td>
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
