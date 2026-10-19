import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { downloadHref } from "@/lib/panel/download";
import { label, statusBadge } from "@/lib/panel/labels";
import { groupStatements, periodLabel, type StatementRow } from "@/lib/panel/statements";
import { createClient } from "@/lib/supabase/server";
import { TicketForm } from "./TicketForm";
import { OwnerRents } from "@/components/panel/OwnerRents";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.managed.detailMeta };
}

export default async function Page(props: PageProps<"/panel/administracion/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const sp = await props.searchParams;
  const rawPeriod = Array.isArray(sp.periodo) ? sp.periodo[0] : sp.periodo;
  const period = typeof rawPeriod === "string" && /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : null;

  const u = await requireUser(`/panel/administracion/${id}`);
  if (!hasRole(u, "propietario") && !isStaffRole(u)) redirect("/panel?aviso=sin-permiso");
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("management_contracts")
    .select("id, owner_user_id, property_label, location_summary, units, services, fee_terms, start_date, end_date, status")
    .eq("id", id)
    .maybeSingle();
  if (!c || (c.owner_user_id !== u.id && !isStaffRole(u))) notFound();

  let movQuery = supabase
    .from("management_movements")
    .select("id, kind, direction, amount, currency, movement_date, period, description, unit_label, receipt_path, status, void_reason")
    .eq("contract_id", id)
    .order("movement_date", { ascending: false })
    .limit(300);
  if (period) movQuery = movQuery.eq("period", period);

  const [statements, movements, tickets, docs] = await Promise.all([
    supabase.from("management_statements").select("period, currency, ingresos, egresos, balance, pendientes_conciliar").eq("contract_id", id),
    movQuery,
    supabase.from("maintenance_tickets").select("id, title, description, priority, status, estimated_cost, currency, created_at, updated_at")
      .eq("contract_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("management_documents").select("id, kind, title, period, created_at").eq("contract_id", id).order("created_at", { ascending: false }),
  ]);
  const groups = groupStatements((statements.data ?? []) as StatementRow[]);
  const { d } = await getI18n();
  const t = d.panel.managed;
  const S = d.status;
  const period_ = (p: string) => periodLabel(p, d.panel.months);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/administracion">{t.breadcrumb}</Link> / <span aria-current="page">{c.property_label}</span>
      </nav>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{c.property_label}</h1>
        <span className={statusBadge(c.status)}>{label(S.contract, c.status)}</span>
      </div>
      <p className="alert alert-info small">
        {t.detailNote}
      </p>

      <section className="card card-body">
        <div className="grid-2">
          {c.location_summary ? <div className="box"><span className="box-label">{t.location}</span><span className="box-value">{c.location_summary}</span></div> : null}
          <div className="box"><span className="box-label">{t.unitsLabel}</span><span className="box-value">{c.units}</span></div>
          <div className="box">
            <span className="box-label">{t.term}</span>
            <span className="box-value">{formatDate(c.start_date)}{c.end_date ? ` – ${formatDate(c.end_date)}` : t.indefinite}</span>
          </div>
          {c.services?.length ? <div className="box"><span className="box-label">{t.services}</span><span className="box-value">{c.services.join(", ")}</span></div> : null}
        </div>
        {c.fee_terms ? <p className="small" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}><strong>{t.fees}</strong> {c.fee_terms}</p> : null}
      </section>

      <OwnerRents supabase={supabase} contractId={id} />

      <section className="card card-body" aria-labelledby="st-title">
        <h2 id="st-title" style={{ marginTop: 0 }}>{t.statement}</h2>
        {statements.error ? <p className="alert alert-error" role="alert">{t.statementError}</p> : null}
        {groups.length === 0 ? (
          <p className="small muted">{t.noMovementsYet}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.statementCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.period}</th>
                  <th scope="col">{t.currency}</th>
                  <th scope="col">{t.income}</th>
                  <th scope="col">{t.expenses}</th>
                  <th scope="col">{t.balance}</th>
                  <th scope="col">{t.toReconcile}</th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g) =>
                  g.rows.map((r, i) => (
                    <tr key={`${g.period}-${r.currency}`}>
                      {i === 0 ? (
                        <th scope="rowgroup" rowSpan={g.rows.length} style={{ textTransform: "capitalize" }}>
                          <Link href={`/panel/administracion/${id}?periodo=${g.period}#movimientos`}>{period_(g.period)}</Link>
                        </th>
                      ) : null}
                      <td>{r.currency}</td>
                      <td>{formatMoney(r.ingresos, r.currency, { decimals: true })}</td>
                      <td>{formatMoney(r.egresos, r.currency, { decimals: true })}</td>
                      <td><strong>{formatMoney(r.balance, r.currency, { decimals: true })}</strong></td>
                      <td>{r.pendientes}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-body" aria-labelledby="mv-title" id="movimientos">
        <div className="row-between">
          <h2 id="mv-title" style={{ margin: 0 }}>{period ? fmt(t.movementsOf, { period: period_(period) }) : t.movements}</h2>
          {period ? <Link className="small" href={`/panel/administracion/${id}#movimientos`}>{t.viewAll}</Link> : null}
        </div>
        {movements.data?.length ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <caption className="sr-only">{t.movementsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.date}</th>
                  <th scope="col">{t.concept}</th>
                  <th scope="col">{t.amount}</th>
                  <th scope="col">{t.status}</th>
                  <th scope="col">{t.receipt}</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.map((m) => (
                  <tr key={m.id} style={m.status === "anulado" ? { opacity: 0.6 } : undefined}>
                    <td>{formatDate(m.movement_date)}</td>
                    <td>
                      {label(S.movementKinds, m.kind)}
                      <div className="xs muted">{m.description}{m.unit_label ? ` · ${m.unit_label}` : ""}</div>
                      {m.status === "anulado" && m.void_reason ? <div className="xs">{fmt(t.voided, { reason: m.void_reason })}</div> : null}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {m.direction === "egreso" ? "− " : "+ "}
                      {formatMoney(m.amount, m.currency as Currency, { decimals: true })}
                    </td>
                    <td><span className={statusBadge(m.status)}>{label(S.movementStatuses, m.status)}</span></td>
                    <td>{m.receipt_path ? <a href={downloadHref("comprobante", m.id)}>{d.panel.shared.download}</a> : <span className="xs muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">{period ? t.noMovementsPeriod : t.noMovements}</p>
        )}
      </section>

      <section className="card card-body" aria-labelledby="tk-title-h">
        <h2 id="tk-title-h" style={{ marginTop: 0 }}>{t.maintenance}</h2>
        {tickets.data?.length ? (
          <ul className="timeline">
            {tickets.data.map((tk) => (
              <li key={tk.id}>
                <div className="row-between">
                  <strong>{tk.title}</strong>
                  <span className="row" style={{ gap: 6 }}>
                    <span className={statusBadge(tk.priority === "urgente" ? "urgente" : "")}>{label(S.ticketPriorities, tk.priority)}</span>
                    <span className={statusBadge(tk.status)}>{label(S.ticketStatuses, tk.status)}</span>
                  </span>
                </div>
                {tk.description ? <div className="small" style={{ whiteSpace: "pre-wrap" }}>{tk.description}</div> : null}
                {tk.estimated_cost && tk.currency ? <div className="xs">{fmt(t.estimatedCost, { amount: formatMoney(tk.estimated_cost, tk.currency as Currency) })}</div> : null}
                <span className="xs muted">{fmt(t.reportedOn, { date: formatDate(tk.created_at, true) })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t.noTickets}</p>
        )}
        {c.owner_user_id === u.id && c.status !== "terminado" ? (
          <div style={{ marginTop: 16 }}>
            <h3 className="small">{t.reportProblem}</h3>
            <TicketForm contractId={c.id} />
          </div>
        ) : null}
      </section>

      <section className="card card-body" aria-labelledby="docs-title">
        <h2 id="docs-title" style={{ marginTop: 0 }}>{t.documents}</h2>
        {docs.data?.length ? (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {docs.data.map((doc) => (
              <li key={doc.id} className="row-between">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {doc.title} <span className="xs muted">({label(S.documentKinds, doc.kind)}{doc.period ? ` · ${period_(doc.period)}` : ""} · {formatDate(doc.created_at)})</span>
                </span>
                <a className="btn btn-ghost btn-sm" href={downloadHref("documento", doc.id)} aria-label={fmt(d.panel.shared.downloadNamed, { name: doc.title })}>{d.panel.shared.download}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t.noDocuments}</p>
        )}
        <p className="xs muted">{t.linksExpire}</p>
      </section>
    </div>
  );
}
