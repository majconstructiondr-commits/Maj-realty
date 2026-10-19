import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { RentPaymentForm } from "./RentPaymentForm";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.rents.meta };
}

type Lease = { id: string; unit_label: string | null; rent_amount: number; currency: Currency; due_day: number; status: string; management_contracts: { property_label: string } | null };
type Charge = { id: string; lease_id: string; period: string; due_date: string; amount: number; currency: Currency; status: string; paid_at: string | null };
type Pay = { id: string; charge_id: string; status: string; review_reason: string | null; created_at: string };

// Clase de la insignia por estado de la cuota (la etiqueta está en el diccionario).
const STATUS_CLS: Record<string, string> = { pendiente: "badge-warning", en_revision: "", pagado: "badge-success", anulado: "" };

export default async function Page() {
  const u = await requireUser("/panel/rentas");
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.rents;
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
      <h1>{t.title}</h1>
      {leases.length === 0 ? (
        <div className="card card-body">
          <p style={{ margin: 0 }}>{t.noLeases} <strong>{u.email}</strong>.</p>
          <p className="small muted" style={{ margin: "6px 0 0" }}>{t.askMaj}</p>
        </div>
      ) : (
        <>
          <div className="card card-body stack">
            <h2 style={{ margin: 0 }}>{t.howToPay}</h2>
            {instructions ? <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{instructions}</p> : <p className="small" style={{ margin: 0 }}>{t.askDetails}</p>}
            <p className="small muted" style={{ margin: 0 }}>{t.afterPaying}</p>
          </div>
          {leases.map((l) => (
            <section key={l.id} className="card card-body stack">
              <h2 style={{ margin: 0 }}>{l.management_contracts?.property_label ?? t.rental}{l.unit_label ? ` · ${l.unit_label}` : ""}</h2>
              <p className="small" style={{ margin: 0 }}>{fmt(t.rentLine, { amount: formatMoney(l.rent_amount, l.currency, { decimals: true }), day: l.due_day })}</p>
              {charges.filter((c) => c.lease_id === l.id).length === 0 ? <p className="muted small">{t.noCharges}</p> : (
                <div className="stack">
                  {charges.filter((c) => c.lease_id === l.id).map((c) => {
                    const label = (t.statuses as Record<string, string>)[c.status] ?? c.status;
                    const cls = STATUS_CLS[c.status] ?? "";
                    const late = c.status === "pendiente" && c.due_date < today;
                    const rejected = payments.find((p) => p.charge_id === c.id && p.status === "rechazado");
                    return (
                      <article key={c.id} className="box stack">
                        <div className="row-between">
                          <strong>{c.period} · {formatMoney(c.amount, c.currency, { decimals: true })}</strong>
                          <span className={`badge ${late ? "badge-danger" : cls}`}>{late ? t.late : label}</span>
                        </div>
                        <span className="small">{fmt(t.due, { date: formatDate(c.due_date) })}{c.paid_at ? fmt(t.confirmed, { date: formatDate(c.paid_at) }) : ""}</span>
                        {c.status === "pendiente" && rejected ? <p className="alert alert-warning small" style={{ margin: 0 }}>{fmt(t.lastRejected, { reason: rejected.review_reason ?? "" })}</p> : null}
                        {c.status === "pendiente" ? (
                          <details>
                            <summary><strong>{t.report}</strong></summary>
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
