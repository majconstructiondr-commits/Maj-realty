import Link from "next/link";
import { Empty, PageHeader, Pagination } from "@/components/admin/Bits";
import { isUuid, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { findUserByEmail, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { addDays, localDayStartIso } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";

const BASE = "/admin/auditoria";
const TABLES = [
  "properties", "property_private", "property_prices", "property_documents", "licenses", "plans", "license_payments",
  "publisher_applications", "organization_members", "service_requests", "legal_services", "quotes", "management_contracts",
  "management_movements", "content_blocks", "site_settings", "user_roles", "profiles",
] as const;
const ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Entry = { id: number; actor_id: string | null; action: string; table_name: string; record_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string };

function changedKeys(e: Entry) {
  if (e.action !== "UPDATE" || !e.old_data || !e.new_data) return [];
  return Object.keys(e.new_data).filter((k) => k !== "updated_at" && JSON.stringify(e.new_data?.[k]) !== JSON.stringify(e.old_data?.[k]));
}
const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "—" : s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

export default async function AdminAudit(props: PageProps<"/admin/auditoria">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const table = oneOf(sp, "tabla", TABLES);
  const action = oneOf(sp, "accion", ACTIONS);
  const registro = str(sp, "registro", 80);
  const actor = str(sp, "actor", 160);
  const desde = DAY.test(str(sp, "desde")) ? str(sp, "desde") : "";
  const hasta = DAY.test(str(sp, "hasta")) ? str(sp, "hasta") : "";
  const { page, pageSize, from, to } = pageOf(sp, 50);

  let actorId: string | null = null;
  let actorError: string | null = null;
  if (actor) {
    if (isUuid(actor)) actorId = actor;
    else {
      const r = await findUserByEmail(supabase, actor);
      if (r.error !== undefined) actorError = r.error;
      else actorId = r.user.id;
    }
  }

  let q = supabase.from("audit_log").select("*", { count: "exact" });
  if (table) q = q.eq("table_name", table);
  if (action) q = q.eq("action", action);
  if (registro) q = q.eq("record_id", registro);
  if (actorId) q = q.eq("actor_id", actorId);
  if (desde) q = q.gte("created_at", localDayStartIso(desde));
  if (hasta) q = q.lt("created_at", localDayStartIso(addDays(hasta, 1)));
  const { data, count, error } = actorError ? { data: [], count: 0, error: null } : await q.order("created_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as Entry[];
  const people = await userLabels(supabase, rows.map((r) => r.actor_id));

  return (
    <>
      <PageHeader title="Auditoría" />
      <p className="small muted">Registro inmutable de cambios en datos sensibles. Solo lectura.</p>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="a-t">Tabla</label><select id="a-t" name="tabla" className="select" defaultValue={table}><option value="">Todas</option>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="a-a">Acción</label><select id="a-a" name="accion" className="select" defaultValue={action}><option value="">Todas</option>{ACTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field"><label htmlFor="a-u">Actor (correo o id)</label><input id="a-u" name="actor" className="input" defaultValue={actor} /></div>
        <div className="field"><label htmlFor="a-r">Registro (id)</label><input id="a-r" name="registro" className="input" defaultValue={registro} /></div>
        <div className="field"><label htmlFor="a-d">Desde</label><input id="a-d" name="desde" type="date" className="input" defaultValue={desde} /></div>
        <div className="field"><label htmlFor="a-h">Hasta</label><input id="a-h" name="hasta" type="date" className="input" defaultValue={hasta} /></div>
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>
      {actorError && <p className="alert alert-warning">{actorError}</p>}
      {error && <p className="alert alert-error">No se pudo cargar la auditoría.</p>}
      {rows.length === 0 ? <Empty>Sin entradas.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Tabla / registro</th><th>Cambios</th></tr></thead>
            <tbody>{rows.map((e) => {
              const keys = changedKeys(e);
              return (
                <tr key={e.id}>
                  <td className="small">{formatDate(e.created_at, true)}</td>
                  <td className="small">{e.actor_id ? <Link href={`${BASE}?actor=${e.actor_id}`}>{labelFor(people, e.actor_id)}</Link> : "Sistema"}</td>
                  <td>{e.action}</td>
                  <td className="small">{e.table_name}{e.record_id && <div className="xs"><Link href={`${BASE}?registro=${encodeURIComponent(e.record_id)}`}>{e.record_id}</Link></div>}</td>
                  <td className="small">
                    {e.action === "UPDATE" ? (
                      keys.length ? (
                        <details><summary>{keys.slice(0, 5).join(", ")}{keys.length > 5 ? "…" : ""}</summary>
                          <ul className="xs">{keys.map((k) => <li key={k}><strong>{k}</strong>: {short(e.old_data?.[k])} → {short(e.new_data?.[k])}</li>)}</ul>
                        </details>
                      ) : "Sin cambios de contenido"
                    ) : (
                      <details><summary>Ver datos</summary><pre className="xs" style={{ whiteSpace: "pre-wrap", maxWidth: 480 }}>{JSON.stringify(e.action === "DELETE" ? e.old_data : e.new_data, null, 2)}</pre></details>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
