import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { StateBadge } from "@/components/listing-editor/StatusBadge";
import { PaymentForm } from "./PaymentForm";

export const metadata: Metadata = { title: "Licencia de publicación", robots: { index: false, follow: false } };

type License = {
  id: string; code: string; status: string; starts_at: string | null; ends_at: string | null; active_listing_quota: number; max_members: number;
  status_reason: string | null; holder_user_id: string | null; organization_id: string | null; created_at: string;
  plan: { name: string; code: string; price: string | number | null; currency: Currency; duration_days: number } | null;
  organization: { name: string } | null;
};
type Plan = { id: string; code: string; name: string; description: string | null; holder_type: "individual" | "organizacion"; price: string | number | null; currency: Currency; duration_days: number; active_listing_quota: number; max_members: number };
type Payment = { id: string; amount: string | number; currency: Currency; method: string; reference: string | null; status: string; review_reason: string | null; created_at: string; reviewed_at: string | null; receipt_path: string | null; license: { code: string } | null };

const METHOD: Record<string, string> = { transferencia: "Transferencia", deposito: "Depósito", efectivo: "Efectivo", otro: "Otro" };
const DAY = 86400000;
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);

export default async function LicensePage() {
  await requireUser("/panel/licencia");
  const ctx = (await getSellerContext())!;
  const supabase = await createClient();
  const [{ data: licData }, { data: planData }, { data: payData }] = await Promise.all([
    supabase
      .from("licenses")
      .select("id, code, status, starts_at, ends_at, active_listing_quota, max_members, status_reason, holder_user_id, organization_id, created_at, plan:plans(name, code, price, currency, duration_days), organization:organizations(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("id, code, name, description, holder_type, price, currency, duration_days, active_listing_quota, max_members").eq("is_active", true).order("sort_order"),
    supabase
      .from("license_payments")
      .select("id, amount, currency, method, reference, status, review_reason, created_at, reviewed_at, receipt_path, license:licenses(code)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const licenses = (licData ?? []) as unknown as License[];
  const plans = (planData ?? []) as Plan[];
  const payments = (payData ?? []) as unknown as Payment[];
  const usage = new Map<string, number | null>(
    await Promise.all(licenses.map(async (l) => [l.id, ((await supabase.rpc("license_usage", { p_license: l.id })).data as number | null) ?? null] as const)),
  );
  const managedOrgs = new Set(ctx.memberships.filter((m) => memberCan(m, "manage_members")).map((m) => m.organization_id));
  const payable = licenses
    .filter((l) => ["pendiente", "activa", "vencida"].includes(l.status))
    .filter((l) => l.holder_user_id === ctx.user.id || (l.organization_id && managedOrgs.has(l.organization_id)))
    .map((l) => ({ id: l.id, label: `${l.code} · ${l.plan?.name ?? "Plan"}${l.organization ? ` · ${l.organization.name}` : ""}`, currency: l.plan?.currency ?? "DOP" }));
  return (
    <div className="section-sm">
      <h1>Licencia de publicación</h1>
      <p className="muted" style={{ maxWidth: "70ch" }}>
        En MAJ, la <strong>licencia</strong> es un permiso contractual interno para publicar inmuebles en esta plataforma, con un número de publicaciones activas y una vigencia.
        No es una licencia profesional ni un permiso del gobierno.
      </p>

      <section aria-labelledby="lic-title" style={{ marginTop: 18 }}>
        <h2 id="lic-title">Mis licencias</h2>
        {!licenses.length ? (
          <div className="card card-body">
            <p style={{ marginTop: 0 }}>Aún no tiene licencias. Cuando MAJ apruebe su solicitud, la licencia aparecerá aquí.</p>
            <Link className="btn btn-primary" href="/panel/publicar">Solicitar para publicar</Link>
          </div>
        ) : (
          <div className="grid" style={{ gap: 14 }}>
            {licenses.map((l) => {
              const used = usage.get(l.id);
              const pct = used !== null && used !== undefined && l.active_listing_quota > 0 ? Math.min(100, Math.round((used / l.active_listing_quota) * 100)) : 0;
              const daysLeft = l.ends_at ? daysUntil(l.ends_at) : null;
              return (
                <article key={l.id} className="card card-body" aria-labelledby={`lic-${l.id}`}>
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div>
                      <h3 id={`lic-${l.id}`} style={{ margin: 0 }}>{l.code}</h3>
                      <span className="small muted">
                        Plan {l.plan?.name ?? "—"}{l.organization ? ` · Agencia ${l.organization.name}` : " · Individual"}
                      </span>
                    </div>
                    <StateBadge value={l.status} />
                  </div>
                  {l.status === "activa" && daysLeft !== null && daysLeft <= 15 ? (
                    <p className="alert alert-warning small" role="note" style={{ marginBottom: 0 }}>
                      {daysLeft <= 0 ? "Su licencia venció." : `Su licencia vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"} (${formatDate(l.ends_at)}).`} Al vencer, sus publicaciones se pausan
                      (no se borran). Para renovar, registre el pago abajo y MAJ actualizará la vigencia.
                    </p>
                  ) : null}
                  {l.status === "vencida" ? <p className="alert alert-error small" style={{ marginBottom: 0 }}>Licencia vencida: sus publicaciones están pausadas. Registre el pago de renovación para que MAJ la reactive.</p> : null}
                  {l.status === "pendiente" ? <p className="alert alert-info small" style={{ marginBottom: 0 }}>Pendiente de activación por MAJ{l.plan?.price === null ? " (el precio del plan aún está por definir)" : ""}.</p> : null}
                  {l.status_reason && l.status !== "activa" ? <p className="small" style={{ marginBottom: 0 }}><strong>Motivo:</strong> {l.status_reason}</p> : null}
                  <div className="facts" style={{ marginTop: 12 }}>
                    <div className="box"><span className="box-label">Inicio</span><span className="box-value">{l.starts_at ? formatDate(l.starts_at) : "—"}</span></div>
                    <div className="box"><span className="box-label">Vence</span><span className="box-value">{l.ends_at ? formatDate(l.ends_at) : "—"}</span></div>
                    <div className="box"><span className="box-label">Miembros máximos</span><span className="box-value">{l.max_members}</span></div>
                    <div className="box">
                      <span className="box-label">Publicaciones activas</span>
                      <span className="box-value">{used ?? "—"} de {l.active_listing_quota}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className={`le-meter${pct >= 100 ? " full" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={l.active_listing_quota} aria-valuenow={used ?? 0} aria-label="Cupo de publicaciones usado">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="xs muted" style={{ margin: "6px 0 0" }}>
                      Cuentan las publicaciones en revisión, publicadas o reservadas. {l.active_listing_quota === 0 ? "MAJ aún no definió el cupo de este plan." : pct >= 100 ? "Cupo agotado: pause, archive o marque como vendida/rentada alguna publicación, o solicite ampliar su plan." : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="plans-title" style={{ marginTop: 28 }}>
        <h2 id="plans-title">Planes disponibles</h2>
        <div className="grid grid-3">
          {plans.map((p) => (
            <article key={p.id} className="card card-body">
              <h3 style={{ marginTop: 0 }}>{p.name}</h3>
              <p className="listing-price" style={{ margin: "4px 0" }}>
                {p.price === null || p.price === "" ? <span className="small muted">Precio por definir por MAJ</span> : formatMoney(p.price, p.currency)}
              </p>
              <ul className="small" style={{ paddingLeft: 18 }}>
                <li>{p.holder_type === "organizacion" ? "Para agencias" : "Individual"}</li>
                <li>Vigencia: {p.duration_days} días</li>
                <li>Publicaciones activas: {p.active_listing_quota > 0 ? p.active_listing_quota : "por definir"}</li>
                {p.holder_type === "organizacion" ? <li>Hasta {p.max_members} miembros</li> : null}
              </ul>
              {p.description ? <p className="xs muted" style={{ marginBottom: 0 }}>{p.description}</p> : null}
            </article>
          ))}
        </div>
        <p className="xs muted">Para cambiar de plan, escríbanos o indíquelo en una nueva solicitud en <Link href="/panel/publicar">Quiero publicar</Link>.</p>
      </section>

      <section aria-labelledby="pay-title" style={{ marginTop: 28 }}>
        <h2 id="pay-title">Registrar un pago</h2>
        <p className="small muted">Pagos manuales (transferencia, depósito o en oficina). Adjunte el comprobante; MAJ lo verifica antes de activar o renovar la licencia.</p>
        {payable.length ? (
          <div className="card card-body"><PaymentForm licenses={payable} /></div>
        ) : (
          <p className="card empty">No tiene licencias a su nombre o de una agencia que usted gestione para registrar pagos.</p>
        )}
      </section>

      <section aria-labelledby="hist-title" style={{ marginTop: 28 }}>
        <h2 id="hist-title">Historial de pagos</h2>
        {payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Pagos registrados</caption>
              <thead>
                <tr><th scope="col">Fecha</th><th scope="col">Licencia</th><th scope="col">Monto</th><th scope="col">Método</th><th scope="col">Estado</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{formatDate(p.created_at, true)}</td>
                    <td className="small">{p.license?.code ?? "—"}</td>
                    <td>{formatMoney(p.amount, p.currency, { decimals: true })}</td>
                    <td className="small">
                      {METHOD[p.method] ?? p.method}
                      {p.reference ? <span className="xs muted" style={{ display: "block" }}>Ref. {p.reference}</span> : null}
                      {p.receipt_path ? <span className="xs muted" style={{ display: "block" }}>Con comprobante</span> : null}
                    </td>
                    <td>
                      <StateBadge value={p.status} />
                      {p.review_reason ? <span className="xs" style={{ display: "block", marginTop: 4 }}>{p.review_reason}</span> : null}
                      {p.reviewed_at ? <span className="xs muted" style={{ display: "block" }}>Revisado el {formatDate(p.reviewed_at)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card empty">No ha registrado pagos.</p>
        )}
      </section>
    </div>
  );
}
