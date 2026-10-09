import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, PageHeader } from "@/components/admin/Bits";
import { QuoteHeaderFields } from "@/components/admin/QuoteHeaderFields";
import type { QuoteStage } from "@/components/admin/StagesEditor";
import { QUOTE_SERVICES, QUOTE_STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import { addQuoteItem, deleteQuoteItem, duplicateQuote, setQuoteStatus, updateQuote, updateQuoteItem } from "../actions";

type Quote = {
  id: string; number: string; request_id: string | null; client_user_id: string | null; client_name: string; service: string; title: string;
  currency: Currency; status: string; valid_until: string | null; tax_label: string | null; tax_rate: number; scope: string | null;
  exclusions: string | null; conditions: string | null; stages: QuoteStage[]; prepared_by: string | null; supersedes_id: string | null;
  sent_at: string | null; responded_at: string | null; client_comment: string | null; created_at: string;
};
type Item = { id: string; sort_order: number; description: string; quantity: number; unit: string; unit_price: number; taxable: boolean };

export default async function QuoteEditor(props: PageProps<"/admin/cotizaciones/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/cotizaciones/${id}`);
  const { data } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const q = data as Quote;
  const [items, totals, events, newer, req] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", id).order("sort_order").order("id"),
    supabase.from("quote_totals").select("subtotal, tax, total").eq("quote_id", id).maybeSingle(),
    supabase.from("quote_events").select("*").eq("quote_id", id).order("created_at", { ascending: false }),
    supabase.from("quotes").select("id, number, status").eq("supersedes_id", id),
    q.request_id ? supabase.from("service_requests").select("id, number").eq("id", q.request_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const itemRows = (items.data ?? []) as Item[];
  const t = totals.data as { subtotal: number; tax: number; total: number } | null;
  const evs = (events.data ?? []) as { id: number; action: string; comment: string | null; actor_id: string | null; created_at: string }[];
  const people = await userLabels(supabase, [q.client_user_id, q.prepared_by, ...evs.map((e) => e.actor_id)]);
  const draft = q.status === "borrador";
  const money = (n: number | string) => formatMoney(Number(n), q.currency, { decimals: true });
  const request = req.data as { id: string; number: string } | null;

  return (
    <>
      <PageHeader title={`Cotización ${q.number}`} back={{ href: "/admin/cotizaciones", label: "Cotizaciones" }}>
        <Badge value={q.status} map={QUOTE_STATUSES} />
        <Link className="btn btn-ghost btn-sm" href={`/admin/cotizaciones/${id}/imprimir`} target="_blank">Vista para imprimir</Link>
      </PageHeader>
      <p className="small muted">
        {labelOf(QUOTE_SERVICES, q.service)} · preparada por {labelFor(people, q.prepared_by)} · creada {formatDate(q.created_at, true)}
        {q.sent_at && <> · enviada {formatDate(q.sent_at, true)}</>}
        {request && <> · solicitud <Link href={`/admin/solicitudes/${request.id}`}>{request.number}</Link></>}
        {q.supersedes_id && <> · reemplaza a <Link href={`/admin/cotizaciones/${q.supersedes_id}`}>versión anterior</Link></>}
        {(newer.data ?? []).map((n) => <span key={n.id as string}> · nueva versión <Link href={`/admin/cotizaciones/${n.id}`}>{n.number as string}</Link></span>)}
      </p>
      {q.client_comment && <p className="alert alert-info">Comentario del cliente ({formatDate(q.responded_at, true)}): {q.client_comment}</p>}

      <section className="card card-body stack">
        <div className="row-between"><h2>Acciones</h2></div>
        <div className="row">
          {draft && (
            <ActionForm action={setQuoteStatus} submit="Enviar al cliente" confirm="Una vez enviada no se podrá modificar (solo crear nueva versión). ¿Enviar?" inline>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="enviada" />
            </ActionForm>
          )}
          {["borrador", "enviada", "aceptada", "rechazada"].includes(q.status) && (
            <ActionForm action={setQuoteStatus} submit="Anular" buttonClass="btn btn-danger" confirm="¿Anular esta cotización? Queda registrada en el historial." inline>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="anulada" />
            </ActionForm>
          )}
          <ActionForm action={duplicateQuote} submit="Duplicar como nueva versión" buttonClass="btn btn-outline" inline>
            <input type="hidden" name="id" value={id} />
          </ActionForm>
        </div>
        {draft && !q.client_user_id && <p className="small muted">Sin cuenta vinculada: al enviarla, entréguela al cliente usando la vista para imprimir.</p>}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Partidas</h2>
        {itemRows.length === 0 && <p className="muted">Sin partidas. Agregue al menos una para poder enviar.</p>}
        {itemRows.map((it) => draft ? (
          <div key={it.id} className="box stack">
            <ActionForm action={updateQuoteItem} submit="Guardar partida" buttonClass="btn btn-ghost btn-sm">
              <input type="hidden" name="id" value={it.id} /><input type="hidden" name="quote_id" value={id} />
              <ItemFields it={it} />
            </ActionForm>
            <ActionForm action={deleteQuoteItem} submit="Eliminar" buttonClass="btn btn-ghost btn-sm" confirm="¿Eliminar esta partida?" inline>
              <input type="hidden" name="id" value={it.id} /><input type="hidden" name="quote_id" value={id} />
              <span className="small muted">Importe: {money(Math.round(it.quantity * it.unit_price * 100) / 100)}</span>
            </ActionForm>
          </div>
        ) : null)}
        {!draft && itemRows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead>
              <tbody>{itemRows.map((it) => (
                <tr key={it.id}><td>{it.description}{!it.taxable && <span className="xs muted"> (exento)</span>}</td><td>{formatNumber(it.quantity, 3)} {it.unit}</td><td>{money(it.unit_price)}</td><td>{money(Math.round(it.quantity * it.unit_price * 100) / 100)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {draft && (
          <details className="box" open={itemRows.length === 0}>
            <summary><strong>+ Agregar partida</strong></summary>
            <ActionForm action={addQuoteItem} submit="Agregar partida" resetOnSuccess>
              <input type="hidden" name="quote_id" value={id} />
              <ItemFields />
            </ActionForm>
          </details>
        )}
        <div className="table-wrap" style={{ maxWidth: 420, marginLeft: "auto" }}>
          <table className="table">
            <tbody>
              <tr><th scope="row">Subtotal</th><td>{money(t?.subtotal ?? 0)}</td></tr>
              <tr><th scope="row">{q.tax_label || "Impuesto"} ({formatNumber(Number(q.tax_rate) * 100, 2)} %)</th><td>{Number(q.tax_rate) > 0 ? money(t?.tax ?? 0) : "No aplica"}</td></tr>
              <tr><th scope="row">Total ({q.currency})</th><td><strong>{money(t?.total ?? 0)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p className="xs muted">Totales calculados por la base de datos.</p>
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Encabezado</h2>
        {draft ? (
          <ActionForm action={updateQuote} submit="Guardar encabezado">
            <input type="hidden" name="id" value={id} />
            <QuoteHeaderFields v={{ ...q, client_label: labelFor(people, q.client_user_id), stages: Array.isArray(q.stages) ? q.stages : [] }} />
          </ActionForm>
        ) : (
          <>
            <p className="small">Una cotización enviada no se modifica. Use “Duplicar como nueva versión”.</p>
            <QuoteHeaderFields v={{ ...q, client_label: labelFor(people, q.client_user_id), stages: Array.isArray(q.stages) ? q.stages : [] }} disabled />
          </>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Historial</h2>
        {evs.length === 0 ? <p className="muted small">Sin eventos.</p> : (
          <ul className="timeline">{evs.map((e) => (
            <li key={e.id}><strong>{labelOf(QUOTE_STATUSES, e.action)}</strong>{e.comment && e.action !== "nueva_version" && <div className="small">{e.comment}</div>}<div className="xs muted">{formatDate(e.created_at, true)} · {labelFor(people, e.actor_id, "Sistema")}</div></li>
          ))}</ul>
        )}
      </section>
    </>
  );
}

function ItemFields({ it }: { it?: Item }) {
  const k = it?.id ?? "new";
  return (
    <div className="form-grid">
      <div className="field"><label htmlFor={`d-${k}`} className="required">Descripción</label><input id={`d-${k}`} name="description" className="input" required maxLength={500} defaultValue={it?.description ?? ""} /></div>
      <div className="field"><label htmlFor={`q-${k}`} className="required">Cantidad</label><input id={`q-${k}`} name="quantity" type="number" min="0.001" step="0.001" className="input" required defaultValue={it?.quantity ?? 1} /></div>
      <div className="field"><label htmlFor={`u-${k}`}>Unidad</label><input id={`u-${k}`} name="unit" className="input" maxLength={30} defaultValue={it?.unit ?? "unidad"} /></div>
      <div className="field"><label htmlFor={`p-${k}`} className="required">Precio unitario</label><input id={`p-${k}`} name="unit_price" type="number" min="0" step="0.01" className="input" required defaultValue={it?.unit_price ?? ""} /></div>
      <div className="field"><label htmlFor={`o-${k}`}>Orden</label><input id={`o-${k}`} name="sort_order" type="number" min="0" step="1" className="input" defaultValue={it?.sort_order ?? ""} /></div>
      <label className="check"><input type="checkbox" name="taxable" defaultChecked={it?.taxable ?? true} /> Grava impuesto</label>
    </div>
  );
}
