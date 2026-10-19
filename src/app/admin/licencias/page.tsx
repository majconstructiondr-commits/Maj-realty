import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, ExportLink, FileLink, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { LICENSE_STATUSES, labelOf } from "@/lib/admin/labels";
import { hrefWith, ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { getSetting, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { isoFromNow, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createLicense, reviewLicensePayment } from "./actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/licencias";
type Lic = {
  id: string; code: string; status: string; starts_at: string | null; ends_at: string | null; holder_user_id: string | null; organization_id: string | null;
  active_listing_quota: number; max_members: number; plans: { name: string } | null; organizations: { name: string } | null;
};
type Pay = { id: string; license_id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null; submitted_by: string; created_at: string; licenses: { code: string } | null };

export default async function AdminLicenses(props: PageProps<"/admin/licencias">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.licenses;
  const status = oneOf(sp, "status", Object.keys(LICENSE_STATUSES));
  const vence = str(sp, "vence") === "1";
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  const notice = Number((await getSetting<number>(supabase, "licenses.expiry_notice_days")) ?? 15);

  let q = supabase.from("licenses").select("id, code, status, starts_at, ends_at, holder_user_id, organization_id, active_listing_quota, max_members, plans(name), organizations(name)", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (vence) q = q.eq("status", "activa").gt("ends_at", isoFromNow(0)).lte("ends_at", isoFromNow(notice * 24));
  if (term) q = q.ilike("code", `%${term}%`);
  const [lic, pays, plans, orgs] = await Promise.all([
    q.order(vence ? "ends_at" : "created_at", { ascending: vence }).range(from, to),
    supabase.from("license_payments").select("id, license_id, amount, currency, method, reference, receipt_path, submitted_by, created_at, licenses(code)").eq("status", "pendiente").order("created_at"),
    supabase.from("plans").select("id, name, holder_type, duration_days, price, currency").order("sort_order"),
    supabase.from("organizations").select("id, name, status").order("name").limit(500),
  ]);
  const rows = (lic.data ?? []) as unknown as Lic[];
  const payRows = (pays.data ?? []) as unknown as Pay[];
  const people = await userLabels(supabase, [...rows.map((r) => r.holder_user_id), ...payRows.map((p) => p.submitted_by)]);

  return (
    <>
      <PageHeader title={t.title}>
        <ExportLink href={hrefWith("/api/admin/export/licencias", sp, { pagina: undefined })}>{c.exportCsv}</ExportLink>
      </PageHeader>
      <p className="small muted">{t.note}</p>

      <section id="pagos" className="card card-body stack" style={{ marginBottom: 16 }}>
        <h2>{fmt(t.pendingPayments, { n: payRows.length })}</h2>
        {payRows.length === 0 ? <p className="muted small">{t.noPayments}</p> : payRows.map((p) => (
          <div key={p.id} className="box stack">
            <div>
              <strong>{formatMoney(p.amount, p.currency, { decimals: true })}</strong> · {labelOf(i.status.paymentMethods, p.method)} {p.reference && `· ${fmt(t.ref, { ref: p.reference })}`} · {t.licenseLower} <Link href={`${BASE}/${p.license_id}`}>{p.licenses?.code}</Link>
              <div className="xs muted">{fmt(t.submittedBy, { who: labelFor(people, p.submitted_by), date: formatDate(p.created_at, true) })} · {p.receipt_path ? <FileLink path={p.receipt_path}>{t.viewReceipt}</FileLink> : t.noReceipt}</div>
            </div>
            <div className="row">
              <ActionForm action={reviewLicensePayment} submit={t.approvePayment} buttonClass="btn btn-primary btn-sm" inline confirm={t.confirmReceived}>
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={p.license_id} /><input type="hidden" name="decision" value="aprobado" />
              </ActionForm>
              <ActionForm action={reviewLicensePayment} submit={t.reject} buttonClass="btn btn-danger btn-sm" inline>
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={p.license_id} /><input type="hidden" name="decision" value="rechazado" />
                <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder={t.rejectReason} aria-label={t.rejectReason} style={{ maxWidth: 260 }} />
              </ActionForm>
            </div>
          </div>
        ))}
      </section>

      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>{t.create}</strong></summary>
        <ActionForm action={createLicense} submit={t.create}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="l-p" className="required">{t.plan}</label>
              <select id="l-p" name="plan_id" className="select" required>
                {((plans.data ?? []) as { id: string; name: string; holder_type: string; duration_days: number; price: number | null; currency: Currency }[]).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.holder_type === "organizacion" ? t.orgLower : t.individual} · {fmt(i.admin.dash.days, { n: p.duration_days })} · {p.price === null ? t.priceTbd : formatMoney(p.price, p.currency)}</option>
                ))}
              </select>
            </div>
            <div className="field"><label htmlFor="l-e">{t.holderEmail}</label><input id="l-e" name="holder_email" type="email" className="input" maxLength={160} /></div>
            <div className="field">
              <label htmlFor="l-o">{t.orOrg}</label>
              <select id="l-o" name="organization_id" className="select" defaultValue="">
                <option value="">—</option>
                {((orgs.data ?? []) as { id: string; name: string; status: string }[]).map((o) => <option key={o.id} value={o.id}>{o.name} ({labelOf(i.status.org, o.status)})</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="l-s" className="required">{t.start}</label><input id="l-s" name="starts_on" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
          </div>
          <label className="check"><input type="checkbox" name="activate" /> {t.activateNow}</label>
          <p className="xs muted">{t.fromPlan}</p>
        </ActionForm>
      </details>

      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="f-q">{c.code}</label><input id="f-q" name="q" className="input" defaultValue={str(sp, "q")} /></div>
        <div className="field"><label htmlFor="f-s">{c.status}</label><select id="f-s" name="status" className="select" defaultValue={status}><Options map={i.status.license} empty={c.all} /></select></div>
        <label className="check"><input type="checkbox" name="vence" value="1" defaultChecked={vence} /> {fmt(t.expiringIn, { n: notice })}</label>
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>

      {lic.error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{c.code}</th><th>{t.holder}</th><th>{t.plan}</th><th>{c.status}</th><th>{t.term}</th><th>{t.quota}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`${BASE}/${r.id}`}><strong>{r.code}</strong></Link></td>
                <td className="small">{r.organizations ? `${r.organizations.name} (${t.orgLower})` : labelFor(people, r.holder_user_id)}</td>
                <td className="small">{r.plans?.name}</td>
                <td><Badge value={r.status} map={i.status.license} /></td>
                <td className="small">{formatDate(r.starts_at)} – {formatDate(r.ends_at)}</td>
                <td className="small">{fmt(t.quotaShort, { q: r.active_listing_quota, m: r.max_members })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={lic.count ?? 0} pageSize={pageSize} />
    </>
  );
}
