import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import type { QuoteStage } from "@/components/admin/StagesEditor";
import { labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import { getSiteSettings } from "@/lib/site";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export default async function QuotePrint(props: PageProps<"/admin/cotizaciones/[id]/imprimir">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/cotizaciones/${id}`);
  const i = (await getI18n()).d;
  const t = i.admin.quotes;
  const [{ data: q }, { data: items }, { data: tot }, s] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order").order("id"),
    supabase.from("quote_totals").select("subtotal, tax, total").eq("quote_id", id).maybeSingle(),
    getSiteSettings(),
  ]);
  if (!q) notFound();
  const cur = q.currency as Currency;
  const money = (n: number | string) => formatMoney(Number(n), cur, { decimals: true });
  const stages = (Array.isArray(q.stages) ? q.stages : []) as QuoteStage[];
  const draft = q.status === "borrador";

  return (
    <article className="stack" style={{ background: "#fff", padding: 24 }}>
      <style>{`@media print { .panel-layout > aside { display: none !important; } .panel-layout { display: block !important; padding: 0 !important; } }`}</style>
      <div className="row no-print"><PrintButton /><Link href={`/admin/cotizaciones/${id}`} className="btn btn-ghost">{t.backToEditor}</Link></div>
      {draft && <p className="alert alert-warning">{t.draftBanner}</p>}
      {q.status === "anulada" && <p className="alert alert-error">{t.voidBanner}</p>}
      <header className="row-between">
        <div>
          <h1 style={{ margin: 0 }}>{s["company.name"]}</h1>
          <div className="small">
            {[s["company.primary_phone"], s["company.email"], s["company.address"]].filter(Boolean).join(" · ")}
            {s["company.rnc"] ? ` · RNC ${s["company.rnc"]}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{fmt(t.quoteN, { n: q.number as string })}</strong>
          <div className="small">{t.dateLabel} {formatDate((q.sent_at ?? q.created_at) as string)}</div>
          <div className="small">{t.validUntilLabel} {formatDate(q.valid_until as string) || "—"}</div>
          <div className="small">{t.statusLabel} {labelOf(i.status.quote, q.status as string)}</div>
        </div>
      </header>
      <hr className="divider" />
      <p><strong>{t.clientLabel}</strong> {q.client_name as string}<br /><strong>{t.serviceLabel}</strong> {labelOf(i.status.quoteServices, q.service as string)}<br /><strong>{t.subjectLabel}</strong> {q.title as string}</p>
      {q.scope && <><h2>{t.scope}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.scope as string}</p></>}
      <table className="table" style={{ border: "1px solid var(--border)" }}>
        <thead><tr><th>#</th><th>{t.description}</th><th>{t.quantity}</th><th>{t.unitPrice}</th><th>{t.amount}</th></tr></thead>
        <tbody>
          {(items ?? []).map((it, n) => (
            <tr key={it.id as string}>
              <td>{n + 1}</td>
              <td>{it.description as string}{!it.taxable && ` ${t.exempt}`}</td>
              <td>{formatNumber(it.quantity as number, 3)} {it.unit as string}</td>
              <td>{money(it.unit_price as number)}</td>
              <td>{money(Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th colSpan={4} scope="row">{t.subtotal}</th><td>{money(tot?.subtotal ?? 0)}</td></tr>
          {Number(q.tax_rate) > 0 && <tr><th colSpan={4} scope="row">{(q.tax_label as string) || t.tax} ({formatNumber(Number(q.tax_rate) * 100, 2)} %)</th><td>{money(tot?.tax ?? 0)}</td></tr>}
          <tr><th colSpan={4} scope="row">{t.total} {cur}</th><td><strong>{money(tot?.total ?? 0)}</strong></td></tr>
        </tfoot>
      </table>
      {stages.length > 0 && (
        <>
          <h2>{t.stages}</h2>
          <ol>{stages.map((st, i) => <li key={i}><strong>{st.name}</strong>{st.duration ? ` · ${st.duration}` : ""}{typeof st.percent === "number" ? ` · ${st.percent} %` : ""}{st.description ? <div className="small">{st.description}</div> : null}</li>)}</ol>
        </>
      )}
      {q.exclusions && <><h2>{t.exclusions}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.exclusions as string}</p></>}
      {q.conditions && <><h2>{t.conditions}</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.conditions as string}</p></>}
      <p className="xs muted">{fmt(t.printFooter, { currency: cur === "DOP" ? t.dop : t.usd, company: String(s["company.name"] ?? "") })}</p>
    </article>
  );
}
