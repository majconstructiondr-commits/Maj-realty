import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { downloadHref } from "@/lib/panel/download";
import {
  CONTRACT_STATUSES, DOCUMENT_KINDS, label, MOVEMENT_KINDS, MOVEMENT_STATUSES, statusBadge, TICKET_PRIORITIES, TICKET_STATUSES,
} from "@/lib/panel/labels";
import { groupStatements, periodLabel, type StatementRow } from "@/lib/panel/statements";
import { createClient } from "@/lib/supabase/server";
import { TicketForm } from "./TicketForm";

export const metadata: Metadata = { title: "Propiedad administrada" };

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

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label="Ruta" className="small muted">
        <Link href="/panel/administracion">Propiedades administradas</Link> / <span aria-current="page">{c.property_label}</span>
      </nav>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{c.property_label}</h1>
        <span className={statusBadge(c.status)}>{label(CONTRACT_STATUSES, c.status)}</span>
      </div>
      <p className="alert alert-info small">
        Registro operativo de la administración; no constituye un estado bancario ni contabilidad certificada. Cada moneda se presenta por separado.
      </p>

      <section className="card card-body">
        <div className="grid-2">
          {c.location_summary ? <div className="box"><span className="box-label">Ubicación</span><span className="box-value">{c.location_summary}</span></div> : null}
          <div className="box"><span className="box-label">Unidades</span><span className="box-value">{c.units}</span></div>
          <div className="box">
            <span className="box-label">Vigencia</span>
            <span className="box-value">{formatDate(c.start_date)}{c.end_date ? ` – ${formatDate(c.end_date)}` : " – indefinida"}</span>
          </div>
          {c.services?.length ? <div className="box"><span className="box-label">Servicios</span><span className="box-value">{c.services.join(", ")}</span></div> : null}
        </div>
        {c.fee_terms ? <p className="small" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}><strong>Honorarios:</strong> {c.fee_terms}</p> : null}
      </section>

      <section className="card card-body" aria-labelledby="st-title">
        <h2 id="st-title" style={{ marginTop: 0 }}>Estado de cuenta por período</h2>
        {statements.error ? <p className="alert alert-error" role="alert">No se pudo cargar el estado de cuenta.</p> : null}
        {groups.length === 0 ? (
          <p className="small muted">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Ingresos, egresos y balance por período y moneda (movimientos anulados excluidos)</caption>
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">Moneda</th>
                  <th scope="col">Ingresos</th>
                  <th scope="col">Egresos</th>
                  <th scope="col">Balance</th>
                  <th scope="col">Por conciliar</th>
                </tr>
              </thead>
              <tbody>
                {groups.flatMap((g) =>
                  g.rows.map((r, i) => (
                    <tr key={`${g.period}-${r.currency}`}>
                      {i === 0 ? (
                        <th scope="rowgroup" rowSpan={g.rows.length} style={{ textTransform: "capitalize" }}>
                          <Link href={`/panel/administracion/${id}?periodo=${g.period}#movimientos`}>{periodLabel(g.period)}</Link>
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
          <h2 id="mv-title" style={{ margin: 0 }}>Movimientos{period ? ` de ${periodLabel(period)}` : ""}</h2>
          {period ? <Link className="small" href={`/panel/administracion/${id}#movimientos`}>Ver todos</Link> : null}
        </div>
        {movements.data?.length ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <caption className="sr-only">Movimientos</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Concepto</th>
                  <th scope="col">Importe</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.map((m) => (
                  <tr key={m.id} style={m.status === "anulado" ? { opacity: 0.6 } : undefined}>
                    <td>{formatDate(m.movement_date)}</td>
                    <td>
                      {label(MOVEMENT_KINDS, m.kind)}
                      <div className="xs muted">{m.description}{m.unit_label ? ` · ${m.unit_label}` : ""}</div>
                      {m.status === "anulado" && m.void_reason ? <div className="xs">Anulado: {m.void_reason}</div> : null}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {m.direction === "egreso" ? "− " : "+ "}
                      {formatMoney(m.amount, m.currency as Currency, { decimals: true })}
                    </td>
                    <td><span className={statusBadge(m.status)}>{label(MOVEMENT_STATUSES, m.status)}</span></td>
                    <td>{m.receipt_path ? <a href={downloadHref("comprobante", m.id)}>Descargar</a> : <span className="xs muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">Sin movimientos{period ? " en este período" : ""}.</p>
        )}
      </section>

      <section className="card card-body" aria-labelledby="tk-title-h">
        <h2 id="tk-title-h" style={{ marginTop: 0 }}>Mantenimiento</h2>
        {tickets.data?.length ? (
          <ul className="timeline">
            {tickets.data.map((t) => (
              <li key={t.id}>
                <div className="row-between">
                  <strong>{t.title}</strong>
                  <span className="row" style={{ gap: 6 }}>
                    <span className={statusBadge(t.priority === "urgente" ? "urgente" : "")}>{label(TICKET_PRIORITIES, t.priority)}</span>
                    <span className={statusBadge(t.status)}>{label(TICKET_STATUSES, t.status)}</span>
                  </span>
                </div>
                {t.description ? <div className="small" style={{ whiteSpace: "pre-wrap" }}>{t.description}</div> : null}
                {t.estimated_cost && t.currency ? <div className="xs">Costo estimado: {formatMoney(t.estimated_cost, t.currency as Currency)}</div> : null}
                <span className="xs muted">Reportado el {formatDate(t.created_at, true)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">No hay solicitudes de mantenimiento.</p>
        )}
        {c.owner_user_id === u.id && c.status !== "terminado" ? (
          <div style={{ marginTop: 16 }}>
            <h3 className="small">Reportar un problema</h3>
            <TicketForm contractId={c.id} />
          </div>
        ) : null}
      </section>

      <section className="card card-body" aria-labelledby="docs-title">
        <h2 id="docs-title" style={{ marginTop: 0 }}>Documentos</h2>
        {docs.data?.length ? (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {docs.data.map((d) => (
              <li key={d.id} className="row-between">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {d.title} <span className="xs muted">({label(DOCUMENT_KINDS, d.kind)}{d.period ? ` · ${periodLabel(d.period)}` : ""} · {formatDate(d.created_at)})</span>
                </span>
                <a className="btn btn-ghost btn-sm" href={downloadHref("documento", d.id)} aria-label={`Descargar ${d.title}`}>Descargar</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">No hay documentos.</p>
        )}
        <p className="xs muted">Los enlaces de descarga se generan al momento y vencen en un minuto.</p>
      </section>
    </div>
  );
}
