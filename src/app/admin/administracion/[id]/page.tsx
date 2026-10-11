import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink, Options, PageHeader } from "@/components/admin/Bits";
import { ContractFields } from "@/components/admin/ContractFields";
import { UploadForm } from "@/components/admin/UploadForm";
import {
  CONTRACT_STATUSES, MGMT_DOC_KINDS, MOVEMENT_KINDS, MOVEMENT_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES, labelOf,
} from "@/lib/admin/labels";
import { isUuid, oneOf, str, type SP } from "@/lib/admin/params";
import { getSetting, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { RentSection } from "@/components/admin/RentSection";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import {
  addManagementDocument, addMovement, addTicket, attachReceipt, grantOwnerRole, reconcileMovement, updateContract, updateTicket, voidMovement,
} from "../actions";

type Mov = {
  id: string; kind: string; direction: string; amount: number; currency: Currency; movement_date: string; period: string; description: string;
  unit_label: string | null; receipt_path: string | null; status: string; void_reason: string | null; created_by: string | null; reconciled_by: string | null;
};
type Stmt = { period: string; currency: Currency; ingresos: number; egresos: number; balance: number; pendientes_conciliar: number };

export default async function ContractDetail(props: PageProps<"/admin/administracion/[id]">) {
  const { id } = await props.params;
  const sp = (await props.searchParams) as SP;
  if (!isUuid(id)) notFound();
  const { supabase, isAdmin } = await staffCtx(`/admin/administracion/${id}`);
  const { data: c } = await supabase.from("management_contracts").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const periodo = /^\d{4}-\d{2}$/.test(str(sp, "periodo")) ? str(sp, "periodo") : "";
  const moneda = oneOf(sp, "moneda", ["DOP", "USD"]);
  const estado = oneOf(sp, "estado", Object.keys(MOVEMENT_STATUSES));

  let mq = supabase.from("management_movements").select("*").eq("contract_id", id);
  if (periodo) mq = mq.eq("period", periodo);
  if (moneda) mq = mq.eq("currency", moneda);
  if (estado) mq = mq.eq("status", estado);
  const [movs, stmts, tickets, docs, roles] = await Promise.all([
    mq.order("movement_date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("management_statements").select("*").eq("contract_id", id).order("period", { ascending: false }).limit(36),
    supabase.from("maintenance_tickets").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("management_documents").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("user_roles").select("role").eq("user_id", c.owner_user_id as string),
  ]);
  const movRows = (movs.data ?? []) as Mov[];
  const people = await userLabels(supabase, [c.owner_user_id as string, ...movRows.map((m) => m.created_by)]);
  const hasOwnerRole = ((roles.data ?? []) as { role: string }[]).some((r) => r.role === "propietario");
  const owner = people.get(c.owner_user_id as string);
  const prefix = `management/${id}`;
  const rol = str(sp, "rol");

  return (
    <>
      <PageHeader title={c.property_label as string} back={{ href: "/admin/administracion", label: "Administración" }}>
        <Badge value={c.status as string} map={CONTRACT_STATUSES} />
        <a className="btn btn-ghost btn-sm" href={`/api/admin/export/movimientos?contrato=${id}${periodo ? `&periodo=${periodo}` : ""}${moneda ? `&moneda=${moneda}` : ""}`}>Exportar CSV</a>
      </PageHeader>
      {rol === "ok" && <p className="alert alert-success">Contrato creado y rol “propietario” otorgado.</p>}
      <p className="small">
        Propietario: <strong>{owner?.full_name || "—"}</strong> {owner?.email && <>· {owner.email}</>} · <Link href={`/admin/usuarios/${c.owner_user_id}`}>ver usuario</Link>
        {hasOwnerRole ? <> · <span className="badge badge-success">Rol propietario activo</span></> : null}
      </p>
      {!hasOwnerRole && (
        <div className="alert alert-warning stack">
          <span>El dueño aún no tiene el rol “propietario”, por lo que no puede ver su portal.</span>
          {isAdmin ? (
            <ActionForm action={grantOwnerRole} submit="Otorgar rol propietario" buttonClass="btn btn-primary btn-sm" inline>
              <input type="hidden" name="contract_id" value={id} />
            </ActionForm>
          ) : <span className="small">Un administrador debe otorgar el rol (solo los administradores gestionan roles).</span>}
        </div>
      )}

      <details className="card card-body">
        <summary><strong>Datos del contrato</strong></summary>
        <ActionForm action={updateContract} submit="Guardar contrato">
          <input type="hidden" name="id" value={id} />
          <ContractFields today={localDay(new Date())} v={c} />
        </ActionForm>
      </details>

      <RentSection supabase={supabase} contractId={id} feeDefault={Number((await getSetting(supabase, "rent.fee_percent")) ?? 5)} />

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Estados de cuenta por período y moneda</h2>
        {(stmts.data ?? []).length === 0 ? <p className="muted small">Sin movimientos.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Período</th><th>Moneda</th><th>Ingresos</th><th>Egresos</th><th>Balance</th><th>Por conciliar</th></tr></thead>
              <tbody>{((stmts.data ?? []) as Stmt[]).map((s) => (
                <tr key={`${s.period}-${s.currency}`}>
                  <td><Link href={`/admin/administracion/${id}?periodo=${s.period}&moneda=${s.currency}`}>{s.period}</Link></td>
                  <td>{s.currency}</td>
                  <td>{formatMoney(s.ingresos, s.currency, { decimals: true })}</td>
                  <td>{formatMoney(s.egresos, s.currency, { decimals: true })}</td>
                  <td><strong>{formatMoney(s.balance, s.currency, { decimals: true })}</strong></td>
                  <td>{s.pendientes_conciliar}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="xs muted">Los movimientos anulados no se incluyen. DOP y USD nunca se suman entre sí.</p>
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Movimientos</h2>
        <details className="box">
          <summary><strong>+ Registrar movimiento</strong></summary>
          <UploadForm action={addMovement} bucket="private-docs" prefix={prefix} required={false} fileLabel="Comprobante (opcional)" submit="Registrar movimiento">
            <input type="hidden" name="contract_id" value={id} />
            <div className="form-grid">
              <div className="field"><label htmlFor="m-k" className="required">Tipo</label><select id="m-k" name="kind" className="select" required><Options map={MOVEMENT_KINDS} /></select></div>
              <div className="field"><label htmlFor="m-d">Dirección (solo ajustes)</label><select id="m-d" name="direction" className="select"><option value="">Automática según tipo</option><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
              <div className="field"><label htmlFor="m-a" className="required">Monto</label><input id="m-a" name="amount" type="number" min="0.01" step="0.01" className="input" required /></div>
              <div className="field"><label htmlFor="m-c" className="required">Moneda</label><select id="m-c" name="currency" className="select"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
              <div className="field"><label htmlFor="m-dt" className="required">Fecha</label><input id="m-dt" name="movement_date" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
              <div className="field"><label htmlFor="m-p" className="required">Período (AAAA-MM)</label><input id="m-p" name="period" type="month" className="input" required defaultValue={currentPeriod()} /></div>
              <div className="field"><label htmlFor="m-u">Unidad</label><input id="m-u" name="unit_label" className="input" maxLength={60} /></div>
            </div>
            <div className="field"><label htmlFor="m-ds" className="required">Descripción</label><input id="m-ds" name="description" className="input" required minLength={2} maxLength={500} /></div>
          </UploadForm>
        </details>
        <form method="get" className="row">
          <input type="month" name="periodo" className="input" defaultValue={periodo} aria-label="Período" style={{ maxWidth: 180 }} />
          <select name="moneda" className="select" defaultValue={moneda} aria-label="Moneda" style={{ maxWidth: 120 }}><option value="">Moneda</option><option value="DOP">DOP</option><option value="USD">USD</option></select>
          <select name="estado" className="select" defaultValue={estado} aria-label="Estado" style={{ maxWidth: 160 }}><Options map={MOVEMENT_STATUSES} empty="Estado" /></select>
          <button className="btn btn-ghost btn-sm" type="submit">Filtrar</button>
        </form>
        {movRows.length === 0 ? <p className="muted small">Sin movimientos.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr></thead>
              <tbody>{movRows.map((m) => (
                <tr key={m.id} style={m.status === "anulado" ? { opacity: 0.6 } : undefined}>
                  <td className="small">{formatDate(m.movement_date)}<div className="xs muted">Período {m.period}</div></td>
                  <td className="small">{labelOf(MOVEMENT_KINDS, m.kind)}<div>{m.description}</div>{m.unit_label && <div className="xs muted">Unidad {m.unit_label}</div>}</td>
                  <td className="small" style={{ color: m.direction === "egreso" ? "var(--danger)" : undefined }}>{m.direction === "egreso" ? "−" : "+"}{formatMoney(m.amount, m.currency, { decimals: true })}</td>
                  <td><Badge value={m.status} map={MOVEMENT_STATUSES} />{m.void_reason && <div className="xs">{m.void_reason}</div>}</td>
                  <td className="small">
                    {m.receipt_path ? <FileLink path={m.receipt_path}>Ver</FileLink> : m.status !== "anulado" ? (
                      <details><summary>Adjuntar</summary>
                        <UploadForm action={attachReceipt} bucket="private-docs" prefix={prefix} submit="Adjuntar">
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                        </UploadForm>
                      </details>
                    ) : "—"}
                  </td>
                  <td>
                    {m.status === "registrado" && (
                      <ActionForm action={reconcileMovement} submit="Conciliar" buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                      </ActionForm>
                    )}
                    {m.status !== "anulado" && (
                      <details><summary className="small">Anular</summary>
                        <ActionForm action={voidMovement} submit="Anular movimiento" buttonClass="btn btn-danger btn-sm">
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                          <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder="Motivo" aria-label="Motivo de anulación" />
                        </ActionForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="xs muted">Los movimientos no se editan: se concilian o se anulan con motivo.</p>
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>Mantenimiento</h2>
          <details className="box"><summary><strong>+ Nuevo ticket</strong></summary>
            <ActionForm action={addTicket} submit="Crear ticket" resetOnSuccess>
              <input type="hidden" name="contract_id" value={id} />
              <div className="field"><label htmlFor="t-t" className="required">Título</label><input id="t-t" name="title" className="input" required minLength={3} maxLength={160} /></div>
              <div className="field"><label htmlFor="t-d">Descripción</label><textarea id="t-d" name="description" className="textarea" maxLength={3000} /></div>
              <div className="form-grid">
                <div className="field"><label htmlFor="t-p">Prioridad</label><select id="t-p" name="priority" className="select" defaultValue="normal"><Options map={TICKET_PRIORITIES} /></select></div>
                <div className="field"><label htmlFor="t-e">Costo estimado</label><input id="t-e" name="estimated_cost" type="number" min="0" step="0.01" className="input" /></div>
                <div className="field"><label htmlFor="t-c">Moneda</label><select id="t-c" name="currency" className="select"><option value="">—</option><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
              </div>
            </ActionForm>
          </details>
          {((tickets.data ?? []) as { id: string; title: string; description: string | null; priority: string; status: string; estimated_cost: number | null; currency: Currency | null; created_at: string }[]).map((t) => (
            <div key={t.id} className="box stack">
              <div><strong>{t.title}</strong> <Badge value={t.status} map={TICKET_STATUSES} /> <Badge value={t.priority} map={TICKET_PRIORITIES} /></div>
              {t.description && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{t.description}</div>}
              <div className="xs muted">{formatDate(t.created_at, true)}{t.estimated_cost != null && t.currency ? ` · estimado ${formatMoney(t.estimated_cost, t.currency)}` : ""}</div>
              <ActionForm action={updateTicket} submit="Actualizar" buttonClass="btn btn-ghost btn-sm" inline>
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="contract_id" value={id} />
                <select name="status" className="select" aria-label="Estado" defaultValue={t.status} style={{ maxWidth: 140 }}><Options map={TICKET_STATUSES} /></select>
                <select name="priority" className="select" aria-label="Prioridad" defaultValue={t.priority} style={{ maxWidth: 120 }}><Options map={TICKET_PRIORITIES} /></select>
                <input name="estimated_cost" type="number" min="0" step="0.01" className="input" aria-label="Costo estimado" defaultValue={t.estimated_cost ?? ""} style={{ maxWidth: 130 }} />
                <select name="currency" className="select" aria-label="Moneda" defaultValue={t.currency ?? ""} style={{ maxWidth: 100 }}><option value="">—</option><option value="DOP">DOP</option><option value="USD">USD</option></select>
              </ActionForm>
            </div>
          ))}
        </section>
        <section className="card card-body stack">
          <h2>Documentos</h2>
          <details className="box"><summary><strong>+ Cargar documento</strong></summary>
            <UploadForm action={addManagementDocument} bucket="private-docs" prefix={prefix} submit="Cargar documento">
              <input type="hidden" name="contract_id" value={id} />
              <div className="form-grid">
                <div className="field"><label htmlFor="d-k" className="required">Tipo</label><select id="d-k" name="kind" className="select"><Options map={MGMT_DOC_KINDS} /></select></div>
                <div className="field"><label htmlFor="d-t" className="required">Título</label><input id="d-t" name="title" className="input" required maxLength={200} /></div>
                <div className="field"><label htmlFor="d-p">Período</label><input id="d-p" name="period" type="month" className="input" /></div>
              </div>
            </UploadForm>
          </details>
          {((docs.data ?? []) as { id: string; kind: string; title: string; period: string | null; storage_path: string; created_at: string }[]).map((d) => (
            <p key={d.id} className="small"><FileLink path={d.storage_path}>{d.title}</FileLink> · {labelOf(MGMT_DOC_KINDS, d.kind)}{d.period ? ` · ${d.period}` : ""} · {formatDate(d.created_at)}</p>
          ))}
          {(docs.data ?? []).length === 0 && <p className="muted small">Sin documentos.</p>}
          <p className="xs muted">Creado por {labelFor(people, c.created_by as string)} el {formatDate(c.created_at as string)}</p>
        </section>
      </div>
    </>
  );
}
