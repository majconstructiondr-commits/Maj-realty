// Vista del propietario: inquilinos y cuotas de renta que MAJ cobra por él (solo lectura).
import type { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, type Currency } from "@/lib/format";

type Db = Awaited<ReturnType<typeof createClient>>;
type Lease = { id: string; unit_label: string | null; tenant_name: string; rent_amount: number; currency: Currency; due_day: number; fee_percent: number; status: string };
type Charge = { id: string; lease_id: string; period: string; due_date: string; amount: number; currency: Currency; status: string; fee_amount: number | null; owner_amount: number | null };

const STATUS: Record<string, string> = { pendiente: "Pendiente", en_revision: "Pago en revisión", pagado: "Cobrada", anulado: "Anulada" };

export async function OwnerRents({ supabase, contractId }: { supabase: Db; contractId: string }) {
  const { data: leaseData } = await supabase.from("rental_leases")
    .select("id, unit_label, tenant_name, rent_amount, currency, due_day, fee_percent, status").eq("contract_id", contractId).order("created_at");
  const leases = (leaseData ?? []) as Lease[];
  if (!leases.length) return null;
  const { data: chargeData } = await supabase.from("rent_charges")
    .select("id, lease_id, period, due_date, amount, currency, status, fee_amount, owner_amount")
    .in("lease_id", leases.map((l) => l.id)).order("period", { ascending: false }).limit(48);
  const charges = (chargeData ?? []) as Charge[];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());

  return (
    <section className="card card-body stack" aria-labelledby="rent-title">
      <h2 id="rent-title" style={{ margin: 0 }}>Cobro de renta</h2>
      {leases.map((l) => (
        <div key={l.id} className="stack">
          <p className="small" style={{ margin: 0 }}>
            <strong>{l.unit_label ? `${l.unit_label} · ` : ""}{l.tenant_name}</strong> · {formatMoney(l.rent_amount, l.currency, { decimals: true })} al mes, día {l.due_day} ·
            comisión MAJ {Number(l.fee_percent)}% {l.status !== "activo" ? "· terminado" : ""}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Período</th><th>Vence</th><th>Renta</th><th>Estado</th><th>Comisión MAJ</th><th>Para usted</th></tr></thead>
              <tbody>{charges.filter((c) => c.lease_id === l.id).map((c) => (
                <tr key={c.id}>
                  <td>{c.period}</td>
                  <td>{formatDate(c.due_date)}</td>
                  <td>{formatMoney(c.amount, c.currency, { decimals: true })}</td>
                  <td>{c.status === "pendiente" && c.due_date < today ? "Atrasada" : (STATUS[c.status] ?? c.status)}</td>
                  <td>{c.fee_amount !== null ? formatMoney(c.fee_amount, c.currency, { decimals: true }) : "—"}</td>
                  <td>{c.owner_amount !== null ? <strong>{formatMoney(c.owner_amount, c.currency, { decimals: true })}</strong> : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="xs muted" style={{ margin: 0 }}>«Para usted» es la renta cobrada menos la comisión de MAJ. El pago al propietario aparece en los movimientos cuando MAJ lo registra.</p>
    </section>
  );
}
