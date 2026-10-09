import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import type { QuoteStage } from "@/components/admin/StagesEditor";
import { QUOTE_SERVICES, QUOTE_STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import { getSiteSettings } from "@/lib/site";

export default async function QuotePrint(props: PageProps<"/admin/cotizaciones/[id]/imprimir">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/cotizaciones/${id}`);
  const [{ data: q }, { data: items }, { data: t }, s] = await Promise.all([
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
      <div className="row no-print"><PrintButton /><Link href={`/admin/cotizaciones/${id}`} className="btn btn-ghost">Volver al editor</Link></div>
      {draft && <p className="alert alert-warning">BORRADOR · no válido como cotización enviada</p>}
      {q.status === "anulada" && <p className="alert alert-error">COTIZACIÓN ANULADA</p>}
      <header className="row-between">
        <div>
          <h1 style={{ margin: 0 }}>{s["company.name"]}</h1>
          <div className="small">
            {[s["company.primary_phone"], s["company.email"], s["company.address"]].filter(Boolean).join(" · ")}
            {s["company.rnc"] ? ` · RNC ${s["company.rnc"]}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>Cotización {q.number as string}</strong>
          <div className="small">Fecha: {formatDate((q.sent_at ?? q.created_at) as string)}</div>
          <div className="small">Válida hasta: {formatDate(q.valid_until as string) || "—"}</div>
          <div className="small">Estado: {labelOf(QUOTE_STATUSES, q.status as string)}</div>
        </div>
      </header>
      <hr className="divider" />
      <p><strong>Cliente:</strong> {q.client_name as string}<br /><strong>Servicio:</strong> {labelOf(QUOTE_SERVICES, q.service as string)}<br /><strong>Asunto:</strong> {q.title as string}</p>
      {q.scope && <><h2>Alcance</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.scope as string}</p></>}
      <table className="table" style={{ border: "1px solid var(--border)" }}>
        <thead><tr><th>#</th><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead>
        <tbody>
          {(items ?? []).map((it, i) => (
            <tr key={it.id as string}>
              <td>{i + 1}</td>
              <td>{it.description as string}{!it.taxable && " (exento)"}</td>
              <td>{formatNumber(it.quantity as number, 3)} {it.unit as string}</td>
              <td>{money(it.unit_price as number)}</td>
              <td>{money(Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th colSpan={4} scope="row">Subtotal</th><td>{money(t?.subtotal ?? 0)}</td></tr>
          {Number(q.tax_rate) > 0 && <tr><th colSpan={4} scope="row">{(q.tax_label as string) || "Impuesto"} ({formatNumber(Number(q.tax_rate) * 100, 2)} %)</th><td>{money(t?.tax ?? 0)}</td></tr>}
          <tr><th colSpan={4} scope="row">Total {cur}</th><td><strong>{money(t?.total ?? 0)}</strong></td></tr>
        </tfoot>
      </table>
      {stages.length > 0 && (
        <>
          <h2>Etapas</h2>
          <ol>{stages.map((st, i) => <li key={i}><strong>{st.name}</strong>{st.duration ? ` · ${st.duration}` : ""}{typeof st.percent === "number" ? ` · ${st.percent} %` : ""}{st.description ? <div className="small">{st.description}</div> : null}</li>)}</ol>
        </>
      )}
      {q.exclusions && <><h2>Exclusiones</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.exclusions as string}</p></>}
      {q.conditions && <><h2>Condiciones</h2><p style={{ whiteSpace: "pre-wrap" }}>{q.conditions as string}</p></>}
      <p className="xs muted">Importes en {cur === "DOP" ? "pesos dominicanos" : "dólares estadounidenses"}. Cotización preparada por personal autorizado de {s["company.name"]}.</p>
    </article>
  );
}
