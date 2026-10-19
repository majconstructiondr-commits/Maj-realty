import Link from "next/link";
import { MoneyByCurrency, PageHeader } from "@/components/admin/Bits";
import { STATUSES, labelOf } from "@/lib/admin/labels";
import { str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { isoFromNow } from "@/lib/admin/time";
import { formatDate, formatNumber, type Currency } from "@/lib/format";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

type Totals = Partial<Record<Currency, { count: number; total: number | string }>>;
type Dash = {
  days: number;
  notice_days: number;
  properties_by_status: Record<string, number>;
  pending_change_requests: number;
  pending_media: number;
  pending_documents: number;
  licenses_expiring: number;
  licenses_pending: number;
  payments_pending: number;
  applications_pending: number;
  unattended_requests: number;
  open_requests_by_kind: Record<string, number>;
  open_property_reports: number;
  open_message_reports: number;
  upcoming_visits: number;
  visits_to_confirm: number;
  views: number;
  whatsapp_clicks: number;
  shares: number;
  saved_inquiries: number;
  closed_properties: number;
  closed_requests: number;
  quotes_accepted: Totals;
  quotes_open: Totals;
  payments_approved: Totals;
  management_balance: Partial<Record<Currency, { ingresos: number; egresos: number }>>;
};

function Stat({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const body = (
    <>
      <div className="num">{typeof value === "number" ? formatNumber(value) : value}</div>
      <div className="small">{label}</div>
      {hint && <div className="xs muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card stat" style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

const totalsOnly = (t: Totals) => Object.fromEntries(Object.entries(t).map(([c, v]) => [c, v?.total ?? 0])) as Partial<Record<Currency, number | string>>;

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin");
  const i = (await getI18n()).d;
  const t = i.admin.dash;
  const days = [7, 30, 90].includes(Number(str(sp, "dias"))) ? Number(str(sp, "dias")) : 30;
  const aviso = str(sp, "aviso");

  const [{ data, error }, { data: visits }, { data: oldest }] = await Promise.all([
    supabase.rpc("staff_dashboard", { p_days: days }),
    supabase
      .from("appointments")
      .select("id, starts_at, kind, status, property_id, properties(code, title)")
      .in("status", ["solicitada", "confirmada"])
      .gte("starts_at", isoFromNow(0))
      .order("starts_at")
      .limit(6),
    supabase
      .from("service_requests")
      .select("id, number, kind, contact_name, created_at")
      .eq("stage", "nuevo")
      .is("assigned_to", null)
      .not("status", "in", "(completada,cerrada,cancelada)")
      .lt("created_at", isoFromNow(-24))
      .order("created_at")
      .limit(6),
  ]);

  if (error || !data) {
    return (
      <>
        <PageHeader title={t.title} />
        <p className="alert alert-error">{t.loadError}</p>
      </>
    );
  }
  const d = data as Dash;
  const ps = d.properties_by_status ?? {};

  return (
    <>
      <PageHeader title={t.title}>
        {[7, 30, 90].map((n) => (
          <Link key={n} href={`/admin?dias=${n}`} className={`btn btn-sm ${n === days ? "btn-primary" : "btn-ghost"}`}>{fmt(t.days, { n })}</Link>
        ))}
      </PageHeader>
      {aviso === "solo-administradores" && <p className="alert alert-warning">{t.adminOnly}</p>}

      <section className="stack" aria-labelledby="pendientes">
        <h2 id="pendientes">{t.pending}</h2>
        <div className="grid-4">
          <Stat label={t.inReview} value={ps.en_revision ?? 0} href="/admin/inmuebles?status=en_revision" />
          <Stat label={t.changes} value={d.pending_change_requests} href="/admin/inmuebles?cambios=1" />
          <Stat label={t.media} value={d.pending_media} href="/admin/inmuebles?multimedia=1" />
          <Stat label={t.docs} value={d.pending_documents} />
          <Stat label={t.unattended} value={d.unattended_requests} href="/admin/solicitudes?stage=nuevo&asignado=ninguno" hint={t.unattendedHint} />
          <Stat label={t.toConfirm} value={d.visits_to_confirm} href="/admin/visitas?status=solicitada" />
          <Stat label={t.upcoming7} value={d.upcoming_visits} href="/admin/visitas" />
          <Stat label={t.openReports} value={d.open_property_reports + d.open_message_reports} href="/admin/reportes" hint={fmt(t.reportsHint, { p: d.open_property_reports, m: d.open_message_reports })} />
          <Stat label={fmt(t.licExpiring, { n: d.notice_days })} value={d.licenses_expiring} href="/admin/licencias?vence=1" />
          <Stat label={t.licPending} value={d.licenses_pending} href="/admin/licencias?status=pendiente" />
          <Stat label={t.payPending} value={d.payments_pending} href="/admin/licencias#pagos" />
          <Stat label={t.applications} value={d.applications_pending} href="/admin/publicadores" />
        </div>
      </section>

      <hr className="divider" />
      <section className="stack" aria-labelledby="actividad">
        <h2 id="actividad">{fmt(t.activity, { n: d.days })}</h2>
        <p className="small muted">
          {t.activityNote}
        </p>
        <div className="grid-4">
          <Stat label={t.views} value={d.views} hint={t.viewsHint} />
          <Stat label={t.wa} value={d.whatsapp_clicks} hint={t.waHint} />
          <Stat label={t.saved} value={d.saved_inquiries} href="/admin/solicitudes" hint={t.savedHint} />
          <Stat label={t.closings} value={d.closed_properties + d.closed_requests} hint={fmt(t.closingsHint, { p: d.closed_properties, r: d.closed_requests })} />
        </div>
        <div className="grid-3">
          <div className="card stat">
            <div className="small">{fmt(t.quotesAccepted, { n: d.days })}</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.quotes_accepted)} empty={t.noneF} /></div>
          </div>
          <div className="card stat">
            <div className="small">{t.quotesOpen}</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.quotes_open)} empty={t.noneF} /></div>
          </div>
          <div className="card stat">
            <div className="small">{fmt(t.paymentsApproved, { n: d.days })}</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.payments_approved)} empty={t.noneM} /></div>
          </div>
        </div>
        {Object.keys(d.management_balance ?? {}).length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.mgmtCaption}</caption>
              <thead><tr><th>{t.mgmtCurrency}</th><th>{t.income}</th><th>{t.expenses}</th></tr></thead>
              <tbody>
                {(Object.entries(d.management_balance) as [Currency, { ingresos: number; egresos: number }][]).map(([c, v]) => (
                  <tr key={c}>
                    <td>{c}</td>
                    <td><MoneyByCurrency totals={{ [c]: v.ingresos }} /></td>
                    <td><MoneyByCurrency totals={{ [c]: v.egresos }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="divider" />
      <div className="grid-2">
        <section className="stack">
          <h2>{t.byStatus}</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.status}</th><th>{t.count}</th></tr></thead>
              <tbody>
                {Object.keys(STATUSES).map((s) => (
                  <tr key={s}>
                    <td><Link href={`/admin/inmuebles?status=${s}`}>{labelOf(i.status.listing, s)}</Link></td>
                    <td>{formatNumber(ps[s] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="stack">
          <h2>{t.openByKind}</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.kind}</th><th>{t.open}</th></tr></thead>
              <tbody>
                {Object.entries(d.open_requests_by_kind ?? {}).length === 0 && <tr><td colSpan={2} className="muted">{t.noOpen}</td></tr>}
                {Object.entries(d.open_requests_by_kind ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <tr key={k}><td><Link href={`/admin/solicitudes?kind=${k}`}>{labelOf(i.status.requestKinds, k)}</Link></td><td>{formatNumber(n)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <hr className="divider" />
      <div className="grid-2">
        <section className="stack">
          <h2>{t.upcoming}</h2>
          {(visits ?? []).length === 0 ? <p className="muted">{t.noVisits}</p> : (
            <ul className="timeline">
              {(visits ?? []).map((v) => {
                const p = v.properties as unknown as { code: string; title: string } | null;
                return (
                  <li key={v.id as string}>
                    <strong>{formatDate(v.starts_at as string, true)}</strong> · {v.status === "solicitada" ? t.pendingConfirm : t.confirmed}
                    <div className="small">{p ? `${p.code} · ${p.title}` : t.meeting}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="stack">
          <h2>{t.unattendedTitle}</h2>
          {(oldest ?? []).length === 0 ? <p className="muted">{t.allDone}</p> : (
            <ul className="timeline">
              {(oldest ?? []).map((r) => (
                <li key={r.id as string}>
                  <Link href={`/admin/solicitudes/${r.id}`}><strong>{r.number as string}</strong></Link> · {labelOf(i.status.requestKinds, r.kind as string)}
                  <div className="small">{r.contact_name as string} · {formatDate(r.created_at as string, true)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
