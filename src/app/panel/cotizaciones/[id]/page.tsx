import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { localDate } from "@/lib/panel/appointments";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { RespondForm } from "./RespondForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.quote.meta };
}

type Stage = { name?: string; title?: string; description?: string; duration?: string; percent?: number; amount?: number };

export default async function Page(props: PageProps<"/panel/cotizaciones/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const u = await requireUser(`/panel/cotizaciones/${id}`);
  const { d } = await getI18n();
  const t = d.panel.quote;
  const QUOTE_STATUSES = d.status.clientQuote;
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("quotes")
    .select("id, number, title, service, currency, status, valid_until, tax_label, tax_rate, scope, exclusions, conditions, stages, client_user_id, client_name, sent_at, responded_at, client_comment, request_id, supersedes_id")
    .eq("id", id)
    .neq("status", "borrador")
    .maybeSingle();
  if (!q) notFound();
  const [items, totals, events] = await Promise.all([
    supabase.from("quote_items").select("id, description, quantity, unit, unit_price, taxable").eq("quote_id", id).order("sort_order"),
    supabase.from("quote_totals").select("subtotal, tax, total").eq("quote_id", id).maybeSingle(),
    supabase.from("quote_events").select("id, action, comment, created_at").eq("quote_id", id).order("created_at"),
  ]);
  const cur = q.currency as Currency;
  const today = localDate(new Date());
  const expired = q.valid_until ? q.valid_until < today : false;
  const stages = (Array.isArray(q.stages) ? q.stages : []) as Stage[];
  const canRespond = q.status === "enviada" && q.client_user_id === u.id;

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/cotizaciones">{t.breadcrumb}</Link> / <span aria-current="page">{q.number}</span>
      </nav>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{fmt(t.title, { number: q.number })}</h1>
        <span className={statusBadge(q.status)}>{label(QUOTE_STATUSES, q.status)}</span>
      </div>
      <p className="lead" style={{ margin: 0 }}>{q.title}</p>

      <section className="card card-body">
        <div className="grid-2">
          <div className="box"><span className="box-label">{t.service}</span><span className="box-value">{label(d.status.quoteServices, q.service)}</span></div>
          <div className="box"><span className="box-label">{t.currency}</span><span className="box-value">{cur === "USD" ? t.currencyUSD : t.currencyDOP}</span></div>
          <div className="box"><span className="box-label">{t.sent}</span><span className="box-value">{q.sent_at ? formatDate(q.sent_at, true) : "—"}</span></div>
          <div className="box">
            <span className="box-label">{t.validUntil}</span>
            <span className="box-value">{q.valid_until ? formatDate(q.valid_until) : "—"}</span>
            {expired && q.status === "enviada" ? <span className="badge badge-danger">{t.expiredBadge}</span> : null}
          </div>
        </div>
        {q.request_id ? <p className="small" style={{ marginTop: 12 }}>{t.relatedRequest} <Link href={`/panel/solicitudes/${q.request_id}`}>{t.viewRequest}</Link></p> : null}
        {q.supersedes_id ? <p className="xs muted">{t.supersedes}</p> : null}
      </section>

      {q.scope ? (
        <section className="card card-body"><h2 style={{ marginTop: 0 }}>{t.scope}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.scope}</p></section>
      ) : null}

      <section className="card card-body" aria-labelledby="q-items">
        <h2 id="q-items" style={{ marginTop: 0 }}>{t.items}</h2>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t.itemsCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.description}</th>
                <th scope="col">{t.quantity}</th>
                <th scope="col">{t.unitPrice}</th>
                <th scope="col">{t.amount}</th>
              </tr>
            </thead>
            <tbody>
              {(items.data ?? []).map((i) => (
                <tr key={i.id}>
                  <td>{i.description}{!i.taxable && q.tax_label ? <div className="xs muted">{fmt(t.exemptFrom, { tax: q.tax_label })}</div> : null}</td>
                  <td>{formatNumber(i.quantity, 3)} {i.unit}</td>
                  <td>{formatMoney(i.unit_price, cur, { decimals: true })}</td>
                  <td>{formatMoney(Math.round(Number(i.quantity) * Number(i.unit_price) * 100) / 100, cur, { decimals: true })}</td>
                </tr>
              ))}
            </tbody>
            {totals.data ? (
              <tfoot>
                <tr><th scope="row" colSpan={3}>{t.subtotal}</th><td>{formatMoney(totals.data.subtotal, cur, { decimals: true })}</td></tr>
                <tr>
                  <th scope="row" colSpan={3}>{q.tax_label ? `${q.tax_label} (${formatNumber(Number(q.tax_rate) * 100, 2)} %)` : t.taxes}</th>
                  <td>{Number(q.tax_rate) > 0 ? formatMoney(totals.data.tax, cur, { decimals: true }) : t.notApplicable}</td>
                </tr>
                <tr><th scope="row" colSpan={3}>{t.total}</th><td><strong>{formatMoney(totals.data.total, cur, { decimals: true })}</strong></td></tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {stages.length ? (
        <section className="card card-body" aria-labelledby="q-stages">
          <h2 id="q-stages" style={{ marginTop: 0 }}>{t.stages}</h2>
          <ol className="timeline">
            {stages.map((s, i) => (
              <li key={i}>
                <strong>{s.name ?? s.title ?? fmt(t.stage, { n: i + 1 })}</strong>
                {s.duration ? <span className="xs muted"> · {s.duration}</span> : null}
                {typeof s.percent === "number" ? <span className="xs muted"> · {s.percent} %</span> : null}
                {typeof s.amount === "number" ? <span className="xs muted"> · {formatMoney(s.amount, cur)}</span> : null}
                {s.description ? <div className="small">{s.description}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {q.exclusions ? (
        <section className="card card-body"><h2 style={{ marginTop: 0 }}>{t.exclusions}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.exclusions}</p></section>
      ) : null}
      {q.conditions ? (
        <section className="card card-body"><h2 style={{ marginTop: 0 }}>{t.conditions}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.conditions}</p></section>
      ) : null}

      <section className="card card-body" aria-labelledby="q-respond">
        <h2 id="q-respond" style={{ marginTop: 0 }}>{t.response}</h2>
        {canRespond && expired ? (
          <p className="alert alert-warning">{t.expiredWarning}</p>
        ) : null}
        {q.client_user_id === u.id ? <RespondForm quoteId={q.id} pending={canRespond} /> : null}
        {!canRespond ? (
          <p className="small">
            {t.statusLabel} <span className={statusBadge(q.status)}>{label(QUOTE_STATUSES, q.status)}</span>
            {q.responded_at ? <>{fmt(t.respondedOn, { date: formatDate(q.responded_at, true) })}</> : null}
            {q.client_comment ? <><br />{fmt(t.yourComment, { comment: q.client_comment })}</> : null}
          </p>
        ) : null}
        {q.status === "vencida" ? (
          <p className="small">
            {t.expiredBefore} <Link href="/panel/mensajes">{t.writeUs}</Link> {t.or} <Link href="/cotizaciones">{t.requestUpdated}</Link>.
          </p>
        ) : null}
      </section>

      <section className="card card-body" aria-labelledby="q-history">
        <h2 id="q-history" style={{ marginTop: 0 }}>{d.panel.shared.history}</h2>
        {events.data?.length ? (
          <ol className="timeline">
            {events.data.map((e) => (
              <li key={e.id}>
                <strong>{label(d.status.quoteEvents, e.action)}</strong>
                {e.comment && e.action !== "nueva_version" ? <div className="small">{e.comment}</div> : null}
                <span className="xs muted">{formatDate(e.created_at, true)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted">{d.panel.shared.noMovements}</p>
        )}
      </section>
    </div>
  );
}
