import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { StateBadge } from "@/components/listing-editor/StatusBadge";
import { PaymentForm } from "./PaymentForm";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.license.meta, robots: { index: false, follow: false } };
}

type License = {
  id: string; code: string; status: string; starts_at: string | null; ends_at: string | null; active_listing_quota: number; max_members: number;
  status_reason: string | null; holder_user_id: string | null; organization_id: string | null; created_at: string;
  plan: { name: string; code: string; price: string | number | null; currency: Currency; duration_days: number } | null;
  organization: { name: string } | null;
};
type Plan = { id: string; code: string; name: string; description: string | null; holder_type: "individual" | "organizacion"; price: string | number | null; currency: Currency; duration_days: number; active_listing_quota: number; max_members: number };
type Payment = { id: string; amount: string | number; currency: Currency; method: string; reference: string | null; status: string; review_reason: string | null; created_at: string; reviewed_at: string | null; receipt_path: string | null; license: { code: string } | null };

const DAY = 86400000;
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);

export default async function LicensePage() {
  await requireUser("/panel/licencia");
  const ctx = (await getSellerContext())!;
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.license;
  const METHOD: Record<string, string> = t.methods;
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
    .map((l) => ({ id: l.id, label: `${l.code} · ${l.plan?.name ?? t.planFallback}${l.organization ? ` · ${l.organization.name}` : ""}`, currency: l.plan?.currency ?? "DOP" }));
  return (
    <div className="section-sm">
      <h1>{t.title}</h1>
      <p className="muted" style={{ maxWidth: "70ch" }}>
        {t.introBefore} <strong>{t.introStrong}</strong> {t.introAfter}
      </p>

      <section aria-labelledby="lic-title" style={{ marginTop: 18 }}>
        <h2 id="lic-title">{t.mine}</h2>
        {!licenses.length ? (
          <div className="card card-body">
            <p style={{ marginTop: 0 }}>{t.none}</p>
            <Link className="btn btn-primary" href="/panel/publicar">{t.request}</Link>
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
                        {fmt(t.plan, { name: l.plan?.name ?? "—" })}{l.organization ? fmt(t.agency, { name: l.organization.name }) : t.individual}
                      </span>
                    </div>
                    <StateBadge value={l.status} />
                  </div>
                  {l.status === "activa" && daysLeft !== null && daysLeft <= 15 ? (
                    <p className="alert alert-warning small" role="note" style={{ marginBottom: 0 }}>
                      {daysLeft <= 0 ? t.expired : fmt(daysLeft === 1 ? t.expiresInOne : t.expiresIn, { n: daysLeft, date: formatDate(l.ends_at) })} {t.expiryNote}
                    </p>
                  ) : null}
                  {l.status === "vencida" ? <p className="alert alert-error small" style={{ marginBottom: 0 }}>{t.expiredAlert}</p> : null}
                  {l.status === "pendiente" ? <p className="alert alert-info small" style={{ marginBottom: 0 }}>{l.plan?.price === null ? t.pendingNoPrice : t.pending}</p> : null}
                  {l.status_reason && l.status !== "activa" ? <p className="small" style={{ marginBottom: 0 }}><strong>{t.reason}</strong> {l.status_reason}</p> : null}
                  <div className="facts" style={{ marginTop: 12 }}>
                    <div className="box"><span className="box-label">{t.start}</span><span className="box-value">{l.starts_at ? formatDate(l.starts_at) : "—"}</span></div>
                    <div className="box"><span className="box-label">{t.ends}</span><span className="box-value">{l.ends_at ? formatDate(l.ends_at) : "—"}</span></div>
                    <div className="box"><span className="box-label">{t.maxMembers}</span><span className="box-value">{l.max_members}</span></div>
                    <div className="box">
                      <span className="box-label">{t.activeListings}</span>
                      <span className="box-value">{fmt(t.usedOf, { used: used ?? "—", quota: l.active_listing_quota })}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className={`le-meter${pct >= 100 ? " full" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={l.active_listing_quota} aria-valuenow={used ?? 0} aria-label={t.quotaAria}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="xs muted" style={{ margin: "6px 0 0" }}>
                      {t.counts} {l.active_listing_quota === 0 ? t.noQuota : pct >= 100 ? t.quotaFull : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="plans-title" style={{ marginTop: 28 }}>
        <h2 id="plans-title">{t.plans}</h2>
        <div className="grid grid-3">
          {plans.map((p) => (
            <article key={p.id} className="card card-body">
              <h3 style={{ marginTop: 0 }}>{p.name}</h3>
              <p className="listing-price" style={{ margin: "4px 0" }}>
                {p.price === null || p.price === "" ? <span className="small muted">{t.priceTbd}</span> : formatMoney(p.price, p.currency)}
              </p>
              <ul className="small" style={{ paddingLeft: 18 }}>
                <li>{p.holder_type === "organizacion" ? t.forAgencies : t.individualPlan}</li>
                <li>{fmt(t.duration, { n: p.duration_days })}</li>
                <li>{fmt(t.listings, { n: p.active_listing_quota > 0 ? p.active_listing_quota : t.tbd })}</li>
                {p.holder_type === "organizacion" ? <li>{fmt(t.upToMembers, { n: p.max_members })}</li> : null}
              </ul>
              {p.description ? <p className="xs muted" style={{ marginBottom: 0 }}>{p.description}</p> : null}
            </article>
          ))}
        </div>
        <p className="xs muted">{t.changePlan} <Link href="/panel/publicar">{t.publishLink}</Link>.</p>
      </section>

      <section aria-labelledby="pay-title" style={{ marginTop: 28 }}>
        <h2 id="pay-title">{t.registerTitle}</h2>
        <p className="small muted">{t.registerIntro}</p>
        {payable.length ? (
          <div className="card card-body"><PaymentForm licenses={payable} /></div>
        ) : (
          <p className="card empty">{t.noPayable}</p>
        )}
      </section>

      <section aria-labelledby="hist-title" style={{ marginTop: 28 }}>
        <h2 id="hist-title">{t.history}</h2>
        {payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.historyCaption}</caption>
              <thead>
                <tr><th scope="col">{t.date}</th><th scope="col">{d.panel.payment.license}</th><th scope="col">{t.amount}</th><th scope="col">{t.method}</th><th scope="col">{t.status}</th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small">{formatDate(p.created_at, true)}</td>
                    <td className="small">{p.license?.code ?? "—"}</td>
                    <td>{formatMoney(p.amount, p.currency, { decimals: true })}</td>
                    <td className="small">
                      {METHOD[p.method] ?? p.method}
                      {p.reference ? <span className="xs muted" style={{ display: "block" }}>{fmt(t.ref, { ref: p.reference })}</span> : null}
                      {p.receipt_path ? <span className="xs muted" style={{ display: "block" }}>{t.withReceipt}</span> : null}
                    </td>
                    <td>
                      <StateBadge value={p.status} />
                      {p.review_reason ? <span className="xs" style={{ display: "block", marginTop: 4 }}>{p.review_reason}</span> : null}
                      {p.reviewed_at ? <span className="xs muted" style={{ display: "block" }}>{fmt(t.reviewedOn, { date: formatDate(p.reviewed_at) })}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card empty">{t.noPayments}</p>
        )}
      </section>
    </div>
  );
}
