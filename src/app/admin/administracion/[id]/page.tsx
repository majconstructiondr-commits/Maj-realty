import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink, Options, PageHeader } from "@/components/admin/Bits";
import { ContractFields } from "@/components/admin/ContractFields";
import { UploadForm } from "@/components/admin/UploadForm";
import { MOVEMENT_STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid, oneOf, str, type SP } from "@/lib/admin/params";
import { getSetting, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { RentSection } from "@/components/admin/RentSection";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import {
  addManagementDocument, addMovement, addTicket, attachReceipt, grantOwnerRole, reconcileMovement, updateContract, updateTicket, voidMovement,
} from "../actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

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
  const i = (await getI18n()).d;
  const S = i.status;
  const ta = i.admin.mgmt;
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
      <PageHeader title={c.property_label as string} back={{ href: "/admin/administracion", label: ta.back }}>
        <Badge value={c.status as string} map={S.contract} />
        <a className="btn btn-ghost btn-sm" href={`/api/admin/export/movimientos?contrato=${id}${periodo ? `&periodo=${periodo}` : ""}${moneda ? `&moneda=${moneda}` : ""}`}>{ta.exportCsv}</a>
      </PageHeader>
      {rol === "ok" && <p className="alert alert-success">{ta.roleOk}</p>}
      <p className="small">
        {ta.ownerLabel} <strong>{owner?.full_name || "—"}</strong> {owner?.email && <>· {owner.email}</>} · <Link href={`/admin/usuarios/${c.owner_user_id}`}>{ta.viewUser}</Link>
        {hasOwnerRole ? <> · <span className="badge badge-success">{ta.ownerRoleActive}</span></> : null}
      </p>
      {!hasOwnerRole && (
        <div className="alert alert-warning stack">
          <span>{ta.noOwnerRole}</span>
          {isAdmin ? (
            <ActionForm action={grantOwnerRole} submit={ta.grantOwnerRole} buttonClass="btn btn-primary btn-sm" inline>
              <input type="hidden" name="contract_id" value={id} />
            </ActionForm>
          ) : <span className="small">{ta.adminMustGrant}</span>}
        </div>
      )}

      <details className="card card-body">
        <summary><strong>{ta.contractData}</strong></summary>
        <ActionForm action={updateContract} submit={ta.saveContract}>
          <input type="hidden" name="id" value={id} />
          <ContractFields today={localDay(new Date())} v={c} />
        </ActionForm>
      </details>

      <RentSection supabase={supabase} contractId={id} feeDefault={Number((await getSetting(supabase, "rent.fee_percent")) ?? 5)} />

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{ta.statements}</h2>
        {(stmts.data ?? []).length === 0 ? <p className="muted small">{ta.noMovements}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{ta.period}</th><th>{ta.currency}</th><th>{ta.income}</th><th>{ta.expenses}</th><th>{ta.balance}</th><th>{ta.toReconcile}</th></tr></thead>
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
        <p className="xs muted">{ta.statementsNote}</p>
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{ta.movements}</h2>
        <details className="box">
          <summary><strong>{ta.addMovementSummary}</strong></summary>
          <UploadForm action={addMovement} bucket="private-docs" prefix={prefix} required={false} fileLabel={ta.receiptOptional} submit={ta.addMovement}>
            <input type="hidden" name="contract_id" value={id} />
            <div className="form-grid">
              <div className="field"><label htmlFor="m-k" className="required">{ta.kind}</label><select id="m-k" name="kind" className="select" required><Options map={S.movementKinds} /></select></div>
              <div className="field"><label htmlFor="m-d">{ta.direction}</label><select id="m-d" name="direction" className="select"><option value="">{ta.auto}</option><option value="ingreso">{ta.incomeOne}</option><option value="egreso">{ta.expenseOne}</option></select></div>
              <div className="field"><label htmlFor="m-a" className="required">{ta.amount}</label><input id="m-a" name="amount" type="number" min="0.01" step="0.01" className="input" required /></div>
              <div className="field"><label htmlFor="m-c" className="required">{ta.currency}</label><select id="m-c" name="currency" className="select"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
              <div className="field"><label htmlFor="m-dt" className="required">{ta.date}</label><input id="m-dt" name="movement_date" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
              <div className="field"><label htmlFor="m-p" className="required">{ta.periodYm}</label><input id="m-p" name="period" type="month" className="input" required defaultValue={currentPeriod()} /></div>
              <div className="field"><label htmlFor="m-u">{ta.unit}</label><input id="m-u" name="unit_label" className="input" maxLength={60} /></div>
            </div>
            <div className="field"><label htmlFor="m-ds" className="required">{ta.description}</label><input id="m-ds" name="description" className="input" required minLength={2} maxLength={500} /></div>
          </UploadForm>
        </details>
        <form method="get" className="row">
          <input type="month" name="periodo" className="input" defaultValue={periodo} aria-label={ta.period} style={{ maxWidth: 180 }} />
          <select name="moneda" className="select" defaultValue={moneda} aria-label={ta.currency} style={{ maxWidth: 120 }}><option value="">{ta.currency}</option><option value="DOP">DOP</option><option value="USD">USD</option></select>
          <select name="estado" className="select" defaultValue={estado} aria-label={ta.status} style={{ maxWidth: 160 }}><Options map={S.movementStatuses} empty={ta.status} /></select>
          <button className="btn btn-ghost btn-sm" type="submit">{ta.filter}</button>
        </form>
        {movRows.length === 0 ? <p className="muted small">{ta.noMovements}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{ta.date}</th><th>{ta.kind}</th><th>{ta.amount}</th><th>{ta.status}</th><th>{ta.receipt}</th><th>{ta.actions}</th></tr></thead>
              <tbody>{movRows.map((m) => (
                <tr key={m.id} style={m.status === "anulado" ? { opacity: 0.6 } : undefined}>
                  <td className="small">{formatDate(m.movement_date)}<div className="xs muted">{fmt(ta.periodN, { p: m.period })}</div></td>
                  <td className="small">{labelOf(S.movementKinds, m.kind)}<div>{m.description}</div>{m.unit_label && <div className="xs muted">{fmt(ta.unitN, { u: m.unit_label })}</div>}</td>
                  <td className="small" style={{ color: m.direction === "egreso" ? "var(--danger)" : undefined }}>{m.direction === "egreso" ? "−" : "+"}{formatMoney(m.amount, m.currency, { decimals: true })}</td>
                  <td><Badge value={m.status} map={S.movementStatuses} />{m.void_reason && <div className="xs">{m.void_reason}</div>}</td>
                  <td className="small">
                    {m.receipt_path ? <FileLink path={m.receipt_path}>{ta.view}</FileLink> : m.status !== "anulado" ? (
                      <details><summary>{ta.attach}</summary>
                        <UploadForm action={attachReceipt} bucket="private-docs" prefix={prefix} submit={ta.attach}>
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                        </UploadForm>
                      </details>
                    ) : "—"}
                  </td>
                  <td>
                    {m.status === "registrado" && (
                      <ActionForm action={reconcileMovement} submit={ta.reconcile} buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                      </ActionForm>
                    )}
                    {m.status !== "anulado" && (
                      <details><summary className="small">{ta.void}</summary>
                        <ActionForm action={voidMovement} submit={ta.voidMovement} buttonClass="btn btn-danger btn-sm">
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="contract_id" value={id} />
                          <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder={ta.reason} aria-label={ta.voidReason} />
                        </ActionForm>
                      </details>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="xs muted">{ta.movementsNote}</p>
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>{ta.maintenance}</h2>
          <details className="box"><summary><strong>{ta.newTicketSummary}</strong></summary>
            <ActionForm action={addTicket} submit={ta.createTicket} resetOnSuccess>
              <input type="hidden" name="contract_id" value={id} />
              <div className="field"><label htmlFor="t-t" className="required">{ta.titleField}</label><input id="t-t" name="title" className="input" required minLength={3} maxLength={160} /></div>
              <div className="field"><label htmlFor="t-d">{ta.description}</label><textarea id="t-d" name="description" className="textarea" maxLength={3000} /></div>
              <div className="form-grid">
                <div className="field"><label htmlFor="t-p">{ta.priority}</label><select id="t-p" name="priority" className="select" defaultValue="normal"><Options map={S.ticketPriorities} /></select></div>
                <div className="field"><label htmlFor="t-e">{ta.estimatedCost}</label><input id="t-e" name="estimated_cost" type="number" min="0" step="0.01" className="input" /></div>
                <div className="field"><label htmlFor="t-c">{ta.currency}</label><select id="t-c" name="currency" className="select"><option value="">—</option><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
              </div>
            </ActionForm>
          </details>
          {((tickets.data ?? []) as { id: string; title: string; description: string | null; priority: string; status: string; estimated_cost: number | null; currency: Currency | null; created_at: string }[]).map((t) => (
            <div key={t.id} className="box stack">
              <div><strong>{t.title}</strong> <Badge value={t.status} map={S.ticketStatuses} /> <Badge value={t.priority} map={S.ticketPriorities} /></div>
              {t.description && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{t.description}</div>}
              <div className="xs muted">{formatDate(t.created_at, true)}{t.estimated_cost != null && t.currency ? ` · ${fmt(ta.estimated, { amount: formatMoney(t.estimated_cost, t.currency) })}` : ""}</div>
              <ActionForm action={updateTicket} submit={ta.update} buttonClass="btn btn-ghost btn-sm" inline>
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="contract_id" value={id} />
                <select name="status" className="select" aria-label={ta.status} defaultValue={t.status} style={{ maxWidth: 140 }}><Options map={S.ticketStatuses} /></select>
                <select name="priority" className="select" aria-label={ta.priority} defaultValue={t.priority} style={{ maxWidth: 120 }}><Options map={S.ticketPriorities} /></select>
                <input name="estimated_cost" type="number" min="0" step="0.01" className="input" aria-label={ta.estimatedCost} defaultValue={t.estimated_cost ?? ""} style={{ maxWidth: 130 }} />
                <select name="currency" className="select" aria-label={ta.currency} defaultValue={t.currency ?? ""} style={{ maxWidth: 100 }}><option value="">—</option><option value="DOP">DOP</option><option value="USD">USD</option></select>
              </ActionForm>
            </div>
          ))}
        </section>
        <section className="card card-body stack">
          <h2>{ta.documents}</h2>
          <details className="box"><summary><strong>{ta.uploadDocSummary}</strong></summary>
            <UploadForm action={addManagementDocument} bucket="private-docs" prefix={prefix} submit={ta.uploadDoc}>
              <input type="hidden" name="contract_id" value={id} />
              <div className="form-grid">
                <div className="field"><label htmlFor="d-k" className="required">{ta.kind}</label><select id="d-k" name="kind" className="select"><Options map={S.mgmtDocKinds} /></select></div>
                <div className="field"><label htmlFor="d-t" className="required">{ta.titleField}</label><input id="d-t" name="title" className="input" required maxLength={200} /></div>
                <div className="field"><label htmlFor="d-p">{ta.period}</label><input id="d-p" name="period" type="month" className="input" /></div>
              </div>
            </UploadForm>
          </details>
          {((docs.data ?? []) as { id: string; kind: string; title: string; period: string | null; storage_path: string; created_at: string }[]).map((d) => (
            <p key={d.id} className="small"><FileLink path={d.storage_path}>{d.title}</FileLink> · {labelOf(S.mgmtDocKinds, d.kind)}{d.period ? ` · ${d.period}` : ""} · {formatDate(d.created_at)}</p>
          ))}
          {(docs.data ?? []).length === 0 && <p className="muted small">{ta.noDocs}</p>}
          <p className="xs muted">{fmt(ta.createdBy, { who: labelFor(people, c.created_by as string), date: formatDate(c.created_at as string) })}</p>
        </section>
      </div>
    </>
  );
}
