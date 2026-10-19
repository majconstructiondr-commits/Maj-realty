// Sección "Inquilinos y cobro de renta" del contrato de administración (personal de MAJ).
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink } from "@/components/admin/Bits";
import type { Db } from "@/lib/admin/server";
import { rentReminderLink } from "@/lib/admin/rent";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createLease, endLease, generateCharges, reviewRentPayment, voidCharge } from "@/app/admin/administracion/rent-actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

type Lease = {
  id: string; unit_label: string | null; tenant_user_id: string | null; tenant_name: string; tenant_email: string | null; tenant_phone: string | null;
  rent_amount: number; currency: Currency; due_day: number; start_date: string; end_date: string | null; fee_percent: number; status: string;
};
type Charge = {
  id: string; lease_id: string; period: string; due_date: string; amount: number; currency: Currency; status: string;
  fee_amount: number | null; owner_amount: number | null; paid_at: string | null;
};
type Payment = {
  id: string; charge_id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null;
  status: string; review_reason: string | null; created_at: string;
};

export async function RentSection({ supabase, contractId, feeDefault }: { supabase: Db; contractId: string; feeDefault: number }) {
  const { data: leaseData } = await supabase.from("rental_leases").select("*").eq("contract_id", contractId).order("created_at");
  const leases = (leaseData ?? []) as Lease[];
  const ids = leases.map((l) => l.id);
  const { data: chargeData } = ids.length
    ? await supabase.from("rent_charges").select("*").in("lease_id", ids).order("period", { ascending: false }).limit(120)
    : { data: [] };
  const charges = (chargeData ?? []) as Charge[];
  const { data: payData } = charges.length
    ? await supabase.from("rent_payments").select("*").in("charge_id", charges.map((c) => c.id)).order("created_at", { ascending: false })
    : { data: [] };
  const payments = (payData ?? []) as Payment[];
  const today = localDay(new Date());
  const t = (await getI18n()).d.admin.rent;

  return (
    <section className="card card-body stack" style={{ marginTop: 16 }} id="rentas">
      <h2>{t.title}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        {t.intro}
      </p>

      {leases.length === 0 ? <p className="muted small">{t.noTenants}</p> : leases.map((l) => {
        const lc = charges.filter((c) => c.lease_id === l.id);
        return (
          <article key={l.id} className="box stack">
            <div className="row-between">
              <strong>{l.unit_label ? `${l.unit_label} · ` : ""}{l.tenant_name}</strong>
              <span className={`badge ${l.status === "activo" ? "badge-success" : ""}`}>{l.status === "activo" ? t.active : t.ended}</span>
            </div>
            <p className="small" style={{ margin: 0 }}>
              {fmt(t.leaseLine, { amount: formatMoney(l.rent_amount, l.currency, { decimals: true }), day: l.due_day, pct: Number(l.fee_percent), start: formatDate(l.start_date) })}
              {l.end_date ? fmt(t.until, { date: formatDate(l.end_date) }) : ""}
              <br />
              {l.tenant_email ?? t.noEmail} · {l.tenant_phone ?? t.noPhone} · {l.tenant_user_id ? t.linkedAccount : t.notSignedIn}
            </p>
            {lc.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>{t.period}</th><th>{t.due}</th><th>{t.amount}</th><th>{t.status}</th><th>{t.feeOwner}</th><th>{t.actions}</th></tr></thead>
                  <tbody>{lc.map((c) => {
                    const overdue = c.status === "pendiente" && c.due_date < today;
                    const pays = payments.filter((p) => p.charge_id === c.id);
                    return (
                      <tr key={c.id}>
                        <td>{c.period}</td>
                        <td>{formatDate(c.due_date)}{overdue ? <div className="error small">{t.overdue}</div> : null}</td>
                        <td>{formatMoney(c.amount, c.currency, { decimals: true })}</td>
                        <td><Badge value={c.status} map={t.chargeStatuses} /></td>
                        <td className="small">{c.fee_amount !== null ? <>{formatMoney(c.fee_amount, c.currency, { decimals: true })} / {formatMoney(c.owner_amount ?? 0, c.currency, { decimals: true })}</> : "—"}</td>
                        <td className="small stack">
                          {c.status === "pendiente" && l.tenant_phone ? (
                            <a className="btn btn-ghost btn-sm" href={rentReminderLink(l.tenant_phone, c, overdue)} target="_blank" rel="noopener noreferrer">{t.whatsapp}</a>
                          ) : null}
                          {pays.map((p) => (
                            <div key={p.id} className="stack" style={{ gap: 4 }}>
                              <span>
                                {t.methods[p.method] ?? p.method} · {formatMoney(p.amount, p.currency, { decimals: true })}
                                {p.reference ? fmt(t.ref, { ref: p.reference }) : ""} · {formatDate(p.created_at, true)}
                                {p.receipt_path ? <> · <FileLink path={p.receipt_path}>{t.receipt}</FileLink></> : null}
                                {p.status === "rechazado" ? <> · <span className="error">{fmt(t.rejected, { reason: p.review_reason ?? "" })}</span></> : null}
                                {p.status === "confirmado" ? t.confirmed : null}
                              </span>
                              {p.status === "pendiente" ? (
                                <div className="row">
                                  <ActionForm action={reviewRentPayment} submit={t.confirmPayment} buttonClass="btn btn-primary btn-sm" inline confirm={t.confirmPaymentQ}>
                                    <input type="hidden" name="id" value={p.id} />
                                    <input type="hidden" name="contract_id" value={contractId} />
                                    <input type="hidden" name="decision" value="confirmar" />
                                  </ActionForm>
                                  <ActionForm action={reviewRentPayment} submit={t.reject} buttonClass="btn btn-ghost btn-sm" inline>
                                    <input type="hidden" name="id" value={p.id} />
                                    <input type="hidden" name="contract_id" value={contractId} />
                                    <input type="hidden" name="decision" value="rechazar" />
                                    <input name="reason" className="input" placeholder={t.reason} aria-label={t.rejectReason} minLength={3} maxLength={500} required />
                                  </ActionForm>
                                </div>
                              ) : null}
                            </div>
                          ))}
                          {c.status === "pendiente" && !pays.some((p) => p.status === "pendiente") ? (
                            <details>
                              <summary>{t.voidCharge}</summary>
                              <ActionForm action={voidCharge} submit={t.void} buttonClass="btn btn-ghost btn-sm">
                                <input type="hidden" name="id" value={c.id} />
                                <input type="hidden" name="contract_id" value={contractId} />
                                <input name="reason" className="input" placeholder={t.reason} aria-label={t.voidReason} minLength={3} maxLength={500} required />
                              </ActionForm>
                            </details>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            ) : <p className="muted small" style={{ margin: 0 }}>{t.noCharges}</p>}
            {l.status === "activo" ? (
              <details>
                <summary className="small">{t.endLease}</summary>
                <ActionForm action={endLease} submit={t.endLease} buttonClass="btn btn-ghost btn-sm" confirm={t.endLeaseQ}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="contract_id" value={contractId} />
                  <div className="field"><label htmlFor={`end-${l.id}`}>{t.endDate}</label><input id={`end-${l.id}`} name="end_date" type="date" className="input" defaultValue={today} required /></div>
                </ActionForm>
              </details>
            ) : null}
          </article>
        );
      })}

      <div className="row" style={{ alignItems: "flex-end" }}>
        <ActionForm action={generateCharges} submit={t.generate} buttonClass="btn btn-ghost btn-sm" inline>
          <input type="hidden" name="contract_id" value={contractId} />
          <input name="period" type="month" className="input" aria-label={t.period} defaultValue={currentPeriod()} required />
        </ActionForm>
        <span className="xs muted">{t.generateNote}</span>
      </div>

      <details className="box">
        <summary><strong>{t.addTenant}</strong></summary>
        <ActionForm action={createLease} submit={t.register} resetOnSuccess>
          <input type="hidden" name="contract_id" value={contractId} />
          <div className="form-grid">
            <div className="field"><label htmlFor="l-name" className="required">{t.tenantName}</label><input id="l-name" name="tenant_name" className="input" required minLength={2} maxLength={160} /></div>
            <div className="field"><label htmlFor="l-unit">{t.unit}</label><input id="l-unit" name="unit_label" className="input" maxLength={60} placeholder={t.unitPlaceholder} /></div>
            <div className="field"><label htmlFor="l-email">{t.email}</label><input id="l-email" name="tenant_email" type="email" className="input" maxLength={160} /></div>
            <div className="field"><label htmlFor="l-phone">{t.phone}</label><input id="l-phone" name="tenant_phone" className="input" inputMode="tel" maxLength={40} /></div>
            <div className="field"><label htmlFor="l-rent" className="required">{t.rent}</label><input id="l-rent" name="rent_amount" type="number" min="0.01" step="0.01" className="input" required /></div>
            <div className="field"><label htmlFor="l-cur" className="required">{t.currency}</label><select id="l-cur" name="currency" className="select"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
            <div className="field"><label htmlFor="l-day" className="required">{t.dueDay}</label><input id="l-day" name="due_day" type="number" min={1} max={28} className="input" required /></div>
            <div className="field"><label htmlFor="l-fee" className="required">{t.fee}</label><input id="l-fee" name="fee_percent" type="number" min={0} max={100} step="0.01" className="input" required defaultValue={feeDefault} /></div>
            <div className="field"><label htmlFor="l-start" className="required">{t.start}</label><input id="l-start" name="start_date" type="date" className="input" required defaultValue={today} /></div>
            <div className="field"><label htmlFor="l-end">{t.endOptional}</label><input id="l-end" name="end_date" type="date" className="input" /></div>
          </div>
          <p className="xs muted" style={{ margin: 0 }}>{t.emailNote}</p>
        </ActionForm>
      </details>
    </section>
  );
}
