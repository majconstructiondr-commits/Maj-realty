// Sección "Inquilinos y cobro de renta" del contrato de administración (personal de MAJ).
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink } from "@/components/admin/Bits";
import type { Db } from "@/lib/admin/server";
import { CHARGE_STATUSES, RENT_METHODS, rentReminderLink } from "@/lib/admin/rent";
import { currentPeriod, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createLease, endLease, generateCharges, reviewRentPayment, voidCharge } from "@/app/admin/administracion/rent-actions";

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

  return (
    <section className="card card-body stack" style={{ marginTop: 16 }} id="rentas">
      <h2>Inquilinos y cobro de renta</h2>
      <p className="small muted" style={{ margin: 0 }}>
        El inquilino ve sus cuotas en «Mis rentas» y sube el comprobante. Al confirmar un pago se registran la renta cobrada y la comisión de MAJ
        (descontada al propietario) en los movimientos de este contrato. Las cuotas solo se generan con el contrato en estado «Activo».
      </p>

      {leases.length === 0 ? <p className="muted small">Sin inquilinos registrados.</p> : leases.map((l) => {
        const lc = charges.filter((c) => c.lease_id === l.id);
        return (
          <article key={l.id} className="box stack">
            <div className="row-between">
              <strong>{l.unit_label ? `${l.unit_label} · ` : ""}{l.tenant_name}</strong>
              <span className={`badge ${l.status === "activo" ? "badge-success" : ""}`}>{l.status === "activo" ? "Activo" : "Terminado"}</span>
            </div>
            <p className="small" style={{ margin: 0 }}>
              {formatMoney(l.rent_amount, l.currency, { decimals: true })} al mes · paga el día {l.due_day} · comisión {Number(l.fee_percent)}% · desde {formatDate(l.start_date)}
              {l.end_date ? ` hasta ${formatDate(l.end_date)}` : ""}
              <br />
              {l.tenant_email ?? "sin correo"} · {l.tenant_phone ?? "sin teléfono"} · {l.tenant_user_id ? "cuenta vinculada" : "aún no ha entrado al sitio"}
            </p>
            {lc.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Período</th><th>Vence</th><th>Monto</th><th>Estado</th><th>Comisión / propietario</th><th>Acciones</th></tr></thead>
                  <tbody>{lc.map((c) => {
                    const overdue = c.status === "pendiente" && c.due_date < today;
                    const pays = payments.filter((p) => p.charge_id === c.id);
                    return (
                      <tr key={c.id}>
                        <td>{c.period}</td>
                        <td>{formatDate(c.due_date)}{overdue ? <div className="error small">Atrasada</div> : null}</td>
                        <td>{formatMoney(c.amount, c.currency, { decimals: true })}</td>
                        <td><Badge value={c.status} map={CHARGE_STATUSES} /></td>
                        <td className="small">{c.fee_amount !== null ? <>{formatMoney(c.fee_amount, c.currency, { decimals: true })} / {formatMoney(c.owner_amount ?? 0, c.currency, { decimals: true })}</> : "—"}</td>
                        <td className="small stack">
                          {c.status === "pendiente" && l.tenant_phone ? (
                            <a className="btn btn-ghost btn-sm" href={rentReminderLink(l.tenant_phone, c, overdue)} target="_blank" rel="noopener noreferrer">Aviso por WhatsApp</a>
                          ) : null}
                          {pays.map((p) => (
                            <div key={p.id} className="stack" style={{ gap: 4 }}>
                              <span>
                                {RENT_METHODS[p.method as keyof typeof RENT_METHODS] ?? p.method} · {formatMoney(p.amount, p.currency, { decimals: true })}
                                {p.reference ? ` · ref. ${p.reference}` : ""} · {formatDate(p.created_at, true)}
                                {p.receipt_path ? <> · <FileLink path={p.receipt_path}>comprobante</FileLink></> : null}
                                {p.status === "rechazado" ? <> · <span className="error">rechazado: {p.review_reason}</span></> : null}
                                {p.status === "confirmado" ? " · confirmado" : null}
                              </span>
                              {p.status === "pendiente" ? (
                                <div className="row">
                                  <ActionForm action={reviewRentPayment} submit="Confirmar pago" buttonClass="btn btn-primary btn-sm" inline confirm="¿Confirmar que el dinero se recibió?">
                                    <input type="hidden" name="id" value={p.id} />
                                    <input type="hidden" name="contract_id" value={contractId} />
                                    <input type="hidden" name="decision" value="confirmar" />
                                  </ActionForm>
                                  <ActionForm action={reviewRentPayment} submit="Rechazar" buttonClass="btn btn-ghost btn-sm" inline>
                                    <input type="hidden" name="id" value={p.id} />
                                    <input type="hidden" name="contract_id" value={contractId} />
                                    <input type="hidden" name="decision" value="rechazar" />
                                    <input name="reason" className="input" placeholder="Motivo" aria-label="Motivo del rechazo" minLength={3} maxLength={500} required />
                                  </ActionForm>
                                </div>
                              ) : null}
                            </div>
                          ))}
                          {c.status === "pendiente" && !pays.some((p) => p.status === "pendiente") ? (
                            <details>
                              <summary>Anular cuota</summary>
                              <ActionForm action={voidCharge} submit="Anular" buttonClass="btn btn-ghost btn-sm">
                                <input type="hidden" name="id" value={c.id} />
                                <input type="hidden" name="contract_id" value={contractId} />
                                <input name="reason" className="input" placeholder="Motivo" aria-label="Motivo de anulación" minLength={3} maxLength={500} required />
                              </ActionForm>
                            </details>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            ) : <p className="muted small" style={{ margin: 0 }}>Sin cuotas todavía.</p>}
            {l.status === "activo" ? (
              <details>
                <summary className="small">Terminar alquiler</summary>
                <ActionForm action={endLease} submit="Terminar alquiler" buttonClass="btn btn-ghost btn-sm" confirm="¿Terminar este alquiler? No se crearán más cuotas.">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="contract_id" value={contractId} />
                  <div className="field"><label htmlFor={`end-${l.id}`}>Fecha de término</label><input id={`end-${l.id}`} name="end_date" type="date" className="input" defaultValue={today} required /></div>
                </ActionForm>
              </details>
            ) : null}
          </article>
        );
      })}

      <div className="row" style={{ alignItems: "flex-end" }}>
        <ActionForm action={generateCharges} submit="Generar cuotas del mes" buttonClass="btn btn-ghost btn-sm" inline>
          <input type="hidden" name="contract_id" value={contractId} />
          <input name="period" type="month" className="input" aria-label="Período" defaultValue={currentPeriod()} required />
        </ActionForm>
        <span className="xs muted">Las cuotas del mes también se crean solas cada día con la tarea programada.</span>
      </div>

      <details className="box">
        <summary><strong>+ Registrar inquilino</strong></summary>
        <ActionForm action={createLease} submit="Registrar inquilino" resetOnSuccess>
          <input type="hidden" name="contract_id" value={contractId} />
          <div className="form-grid">
            <div className="field"><label htmlFor="l-name" className="required">Nombre del inquilino</label><input id="l-name" name="tenant_name" className="input" required minLength={2} maxLength={160} /></div>
            <div className="field"><label htmlFor="l-unit">Unidad</label><input id="l-unit" name="unit_label" className="input" maxLength={60} placeholder="Ej.: Apto 2B" /></div>
            <div className="field"><label htmlFor="l-email">Correo</label><input id="l-email" name="tenant_email" type="email" className="input" maxLength={160} /></div>
            <div className="field"><label htmlFor="l-phone">Teléfono / WhatsApp</label><input id="l-phone" name="tenant_phone" className="input" inputMode="tel" maxLength={40} /></div>
            <div className="field"><label htmlFor="l-rent" className="required">Renta mensual</label><input id="l-rent" name="rent_amount" type="number" min="0.01" step="0.01" className="input" required /></div>
            <div className="field"><label htmlFor="l-cur" className="required">Moneda</label><select id="l-cur" name="currency" className="select"><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
            <div className="field"><label htmlFor="l-day" className="required">Día de pago (1 a 28)</label><input id="l-day" name="due_day" type="number" min={1} max={28} className="input" required /></div>
            <div className="field"><label htmlFor="l-fee" className="required">Comisión MAJ (%)</label><input id="l-fee" name="fee_percent" type="number" min={0} max={100} step="0.01" className="input" required defaultValue={feeDefault} /></div>
            <div className="field"><label htmlFor="l-start" className="required">Inicio</label><input id="l-start" name="start_date" type="date" className="input" required defaultValue={today} /></div>
            <div className="field"><label htmlFor="l-end">Fin (opcional)</label><input id="l-end" name="end_date" type="date" className="input" /></div>
          </div>
          <p className="xs muted" style={{ margin: 0 }}>Indique el correo con el que el inquilino entrará al sitio: así queda vinculado a sus cuotas.</p>
        </ActionForm>
      </details>
    </section>
  );
}
