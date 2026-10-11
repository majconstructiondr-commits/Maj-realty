import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RentPaymentForm } from "./RentPaymentForm";

export const metadata: Metadata = { title: "Mis rentas" };

type Lease = { id: string; unit_label: string | null; rent_amount: number; currency: Currency; due_day: number; status: string; management_contracts: { property_label: string } | null };
type Charge = { id: string; lease_id: string; period: string; due_date: string; amount: number; currency: Currency; status: string; paid_at: string | null };
type Pay = { id: string; charge_id: string; status: string; review_reason: string | null; created_at: string };

const STATUS: Record<string, [string, string]> = {
  pendiente: ["Pendiente", "badge-warning"], en_revision: ["Pago en revisión", ""], pagado: ["Pagado", "badge-success"], anulado: ["Anulado", ""],
};

export default async function Page() {
  const u = await requireUser("/panel/rentas");
  const supabase = await createClient();
  await supabase.rpc("link_my_leases");
  const [{ data: leaseData }, { data: chargeData }, { data: payData }, { data: instr }] = await Promise.all([
    supabase.from("rental_leases").select("id, unit_label, rent_amount, currency, due_day, status, management_contracts(property_label)").eq("tenant_user_id", u.id),
    supabase.from("rent_charges").select("id, lease_id, period, due_date, amount, currency, status, paid_at").order("period", { ascending: false }).limit(60),
    supabase.from("rent_payments").select("id, charge_id, status, review_reason, created_at").eq("submitted_by", u.id).order("created_at", { ascending: false }),
    supabase.from("site_settings").select("value").eq("key", "rent.payment_instructions").maybeSingle(),
  ]);
  const leases = (leaseData ?? []) as unknown as Lease[];
  const leaseIds = new Set(leases.map((l) => l.id));
  const charges = ((chargeData ?? []) as Charge[]).filter((c) => leaseIds.has(c.lease_id));
  const payments = (payData ?? []) as Pay[];
  const instructions = typeof instr?.value === "string" && instr.value.trim() ? instr.value : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Mis rentas</h1>
      {leases.length === 0 ? (
        <div className="card card-body">
          <p style={{ margin: 0 }}>No tiene alquileres registrados con el correo <strong>{u.email}</strong>.</p>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Si MAJ administra el cobro de su renta, pídale que registre este correo.</p>
        </div>
      ) : (
        <>
          <div className="card card-body stack">
            <h2 style={{ margin: 0 }}>Cómo pagar</h2>
            {instructions ? <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{instructions}</p> : <p className="small" style={{ margin: 0 }}>Pida a MAJ REALTY los datos de transferencia.</p>}
            <p className="small muted" style={{ margin: 0 }}>Después de pagar, informe el pago aquí con la referencia o el comprobante. MAJ lo verifica y le avisa.</p>
          </div>
          {leases.map((l) => (
            <section key={l.id} className="card card-body stack">
              <h2 style={{ margin: 0 }}>{l.management_contracts?.property_label ?? "Alquiler"}{l.unit_label ? ` · ${l.unit_label}` : ""}</h2>
              <p className="small" style={{ margin: 0 }}>Renta: {formatMoney(l.rent_amount, l.currency, { decimals: true })} al mes, se paga el día {l.due_day}.</p>
              {charges.filter((c) => c.lease_id === l.id).length === 0 ? <p className="muted small">Aún no hay cuotas.</p> : (
                <div className="stack">
                  {charges.filter((c) => c.lease_id === l.id).map((c) => {
                    const [label, cls] = STATUS[c.status] ?? [c.status, ""];
                    const late = c.status === "pendiente" && c.due_date < today;
                    const rejected = payments.find((p) => p.charge_id === c.id && p.status === "rechazado");
                    return (
                      <article key={c.id} className="box stack">
                        <div className="row-between">
                          <strong>{c.period} · {formatMoney(c.amount, c.currency, { decimals: true })}</strong>
                          <span className={`badge ${late ? "badge-danger" : cls}`}>{late ? "Atrasada" : label}</span>
                        </div>
                        <span className="small">Vence el {formatDate(c.due_date)}{c.paid_at ? ` · confirmado el ${formatDate(c.paid_at)}` : ""}</span>
                        {c.status === "pendiente" && rejected ? <p className="alert alert-warning small" style={{ margin: 0 }}>Su último pago no se confirmó: {rejected.review_reason}</p> : null}
                        {c.status === "pendiente" ? (
                          <details>
                            <summary><strong>Informar pago</strong></summary>
                            <RentPaymentForm chargeId={c.id} amount={c.amount} currency={c.currency} />
                          </details>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
