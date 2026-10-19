import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { FileLink, PageHeader } from "@/components/admin/Bits";
import { staffCtx } from "@/lib/admin/server";
import { rentReminderLink } from "@/lib/admin/rent";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { generateCharges, reviewRentPayment } from "../administracion/rent-actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

type LeaseRef = { contract_id: string; tenant_name: string; unit_label: string | null; tenant_phone: string | null };
type ChargeRef = { id: string; period: string; due_date: string; amount: number; currency: Currency; rental_leases: LeaseRef };
type Pay = { id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null; created_at: string; rent_charges: ChargeRef };

export default async function AdminRents() {
  const { supabase } = await staffCtx("/admin/rentas");
  const i = (await getI18n()).d;
  const t = i.admin.rents;
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
      <PageHeader title={t.title} />
      <p className="small muted">{t.note}</p>

      <section className="card card-body stack">
        <h2>{fmt(t.toVerify, { n: payments.length })}</h2>
        {payments.length === 0 ? <p className="muted small">{t.noPayments}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.tenant}</th><th>{t.charge}</th><th>{t.reported}</th><th>{t.actions}</th></tr></thead>
              <tbody>{payments.map((p) => {
                const c = p.rent_charges;
                const mismatch = p.amount !== c.amount || p.currency !== c.currency;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/administracion/${c.rental_leases.contract_id}#rentas`}>{who(c.rental_leases)}</Link></td>
                    <td>{c.period} · {formatMoney(c.amount, c.currency, { decimals: true })}</td>
                    <td className="small">
                      {i.admin.rent.methods[p.method] ?? p.method} · {formatMoney(p.amount, p.currency, { decimals: true })}
                      {p.reference ? ` · ${fmt(t.ref, { ref: p.reference })}` : ""} · {formatDate(p.created_at, true)}
                      {p.receipt_path ? <> · <FileLink path={p.receipt_path}>{t.receipt}</FileLink></> : null}
                      {mismatch ? <div className="error">{t.mismatch}</div> : null}
                    </td>
                    <td className="stack">
                      {!mismatch ? (
                        <ActionForm action={reviewRentPayment} submit={t.confirm} buttonClass="btn btn-primary btn-sm" inline confirm={t.confirmQ}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="decision" value="confirmar" />
                        </ActionForm>
                      ) : null}
                      <ActionForm action={reviewRentPayment} submit={t.reject} buttonClass="btn btn-ghost btn-sm" inline>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="decision" value="rechazar" />
                        <input name="reason" className="input" placeholder={t.reason} aria-label={t.rejectReason} minLength={3} maxLength={500} required />
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
        <h2>{fmt(t.overdueN, { n: overdue.length })}</h2>
        {overdue.length === 0 ? <p className="muted small">{t.noOverdue}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.tenant}</th><th>{t.period}</th><th>{t.dueOn}</th><th>{t.amount}</th><th></th></tr></thead>
              <tbody>{overdue.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/administracion/${c.rental_leases.contract_id}#rentas`}>{who(c.rental_leases)}</Link></td>
                  <td>{c.period}</td>
                  <td>{formatDate(c.due_date)}</td>
                  <td>{formatMoney(c.amount, c.currency, { decimals: true })}</td>
                  <td>{c.rental_leases.tenant_phone ? <a className="btn btn-ghost btn-sm" href={rentReminderLink(c.rental_leases.tenant_phone, c, true)} target="_blank" rel="noopener noreferrer">{t.waReminder}</a> : <span className="xs muted">{t.noPhone}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{t.generate}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t.generateNote}</p>
        <ActionForm action={generateCharges} submit={t.generate} buttonClass="btn btn-ghost btn-sm" inline>
          <input name="period" type="month" className="input" aria-label={t.period} defaultValue={currentPeriod()} required />
        </ActionForm>
      </section>
    </>
  );
}
