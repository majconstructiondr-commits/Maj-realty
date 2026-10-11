import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { FileLink, PageHeader } from "@/components/admin/Bits";
import { staffCtx } from "@/lib/admin/server";
import { RENT_METHODS, rentReminderLink } from "@/lib/admin/rent";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { generateCharges, reviewRentPayment } from "../administracion/rent-actions";

type LeaseRef = { contract_id: string; tenant_name: string; unit_label: string | null; tenant_phone: string | null };
type ChargeRef = { id: string; period: string; due_date: string; amount: number; currency: Currency; rental_leases: LeaseRef };
type Pay = { id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null; created_at: string; rent_charges: ChargeRef };

export default async function AdminRents() {
  const { supabase } = await staffCtx("/admin/rentas");
  const today = localDay(new Date());
  const [pays, late] = await Promise.all([
    supabase.from("rent_payments")
      .select("id, amount, currency, method, reference, receipt_path, created_at, rent_charges!inner(id, period, due_date, amount, currency, rental_leases!inner(contract_id, tenant_name, unit_label, tenant_phone))")
      .eq("status", "pendiente").order("created_at").limit(200),
    supabase.from("rent_charges")
      .select("id, period, due_date, amount, currency, rental_leases!inner(contract_id, tenant_name, unit_label, tenant_phone)")
      .eq("status", "pendiente").lt("due_date", today).order("due_date").limit(200),
  ]);
  const payments = (pays.data ?? []) as unknown as Pay[];
  const overdue = (late.data ?? []) as unknown as ChargeRef[];
  const who = (l: LeaseRef) => `${l.unit_label ? `${l.unit_label} · ` : ""}${l.tenant_name}`;

  return (
    <>
      <PageHeader title="Cobro de rentas" />
      <p className="small muted">Pagos informados por inquilinos para verificar y cuotas atrasadas. El dinero no pasa por el sistema: confirme solo cuando lo vea en la cuenta.</p>

      <section className="card card-body stack">
        <h2>Pagos por verificar ({payments.length})</h2>
        {payments.length === 0 ? <p className="muted small">No hay pagos pendientes.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Inquilino</th><th>Cuota</th><th>Pago informado</th><th>Acciones</th></tr></thead>
              <tbody>{payments.map((p) => {
                const c = p.rent_charges;
                const mismatch = p.amount !== c.amount || p.currency !== c.currency;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/administracion/${c.rental_leases.contract_id}#rentas`}>{who(c.rental_leases)}</Link></td>
                    <td>{c.period} · {formatMoney(c.amount, c.currency, { decimals: true })}</td>
                    <td className="small">
                      {RENT_METHODS[p.method as keyof typeof RENT_METHODS] ?? p.method} · {formatMoney(p.amount, p.currency, { decimals: true })}
                      {p.reference ? ` · ref. ${p.reference}` : ""} · {formatDate(p.created_at, true)}
                      {p.receipt_path ? <> · <FileLink path={p.receipt_path}>comprobante</FileLink></> : null}
                      {mismatch ? <div className="error">El monto no coincide con la cuota: rechácelo con el motivo.</div> : null}
                    </td>
                    <td className="stack">
                      {!mismatch ? (
                        <ActionForm action={reviewRentPayment} submit="Confirmar pago" buttonClass="btn btn-primary btn-sm" inline confirm="¿Confirmar que el dinero se recibió?">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="decision" value="confirmar" />
                        </ActionForm>
                      ) : null}
                      <ActionForm action={reviewRentPayment} submit="Rechazar" buttonClass="btn btn-ghost btn-sm" inline>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="decision" value="rechazar" />
                        <input name="reason" className="input" placeholder="Motivo" aria-label="Motivo del rechazo" minLength={3} maxLength={500} required />
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Cuotas atrasadas ({overdue.length})</h2>
        {overdue.length === 0 ? <p className="muted small">No hay cuotas atrasadas.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Inquilino</th><th>Período</th><th>Venció</th><th>Monto</th><th></th></tr></thead>
              <tbody>{overdue.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/administracion/${c.rental_leases.contract_id}#rentas`}>{who(c.rental_leases)}</Link></td>
                  <td>{c.period}</td>
                  <td>{formatDate(c.due_date)}</td>
                  <td>{formatMoney(c.amount, c.currency, { decimals: true })}</td>
                  <td>{c.rental_leases.tenant_phone ? <a className="btn btn-ghost btn-sm" href={rentReminderLink(c.rental_leases.tenant_phone, c, true)} target="_blank" rel="noopener noreferrer">Aviso por WhatsApp</a> : <span className="xs muted">sin teléfono</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Generar cuotas</h2>
        <p className="small muted" style={{ margin: 0 }}>Crea las cuotas del mes para todos los alquileres activos de contratos activos. No duplica las que ya existen.</p>
        <ActionForm action={generateCharges} submit="Generar cuotas" buttonClass="btn btn-ghost btn-sm" inline>
          <input name="period" type="month" className="input" aria-label="Período" defaultValue={currentPeriod()} required />
        </ActionForm>
      </section>
    </>
  );
}
