import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { MESSAGE_REPORT_STATUSES, PROPERTY_REPORT_STATUSES, REPORT_REASONS, labelOf } from "@/lib/admin/labels";
import { oneOf, pageOf, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { resolveMessageReport } from "../mensajes/actions";
import { updatePropertyReport } from "./actions";

const BASE = "/admin/reportes";
type PR = { id: string; property_id: string; reporter_id: string | null; reason: string; details: string | null; contact_email: string | null; status: string; resolution: string | null; resolved_by: string | null; created_at: string; properties: { code: string; title: string; status: string } | null };
type MR = { id: string; message_id: string; reporter_id: string; reason: string; status: string; resolution: string | null; resolved_by: string | null; created_at: string; messages: { body: string; conversation_id: string; sender_id: string; hidden: boolean } | null };

export default async function AdminReports(props: PageProps<"/admin/reportes">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const pstatus = oneOf(sp, "estado", Object.keys(PROPERTY_REPORT_STATUSES));
  const mstatus = oneOf(sp, "estado_mensajes", Object.keys(MESSAGE_REPORT_STATUSES));
  const { page, pageSize, from, to } = pageOf(sp);
  let pq = supabase.from("property_reports").select("*, properties(code, title, status)", { count: "exact" });
  pq = pstatus ? pq.eq("status", pstatus) : pq.in("status", ["abierto", "en_revision"]);
  let mq = supabase.from("message_reports").select("*, messages(body, conversation_id, sender_id, hidden)");
  mq = mq.eq("status", mstatus || "abierto");
  const [prs, mrs] = await Promise.all([
    pq.order("created_at", { ascending: true }).range(from, to),
    mq.order("created_at", { ascending: true }).limit(100),
  ]);
  const pRows = (prs.data ?? []) as unknown as PR[];
  const mRows = (mrs.data ?? []) as unknown as MR[];
  const people = await userLabels(supabase, [...pRows.flatMap((r) => [r.reporter_id, r.resolved_by]), ...mRows.flatMap((r) => [r.reporter_id, r.resolved_by, r.messages?.sender_id])]);

  return (
    <>
      <PageHeader title="Reportes y moderación" />
      <section className="stack">
        <div className="row-between">
          <h2>Reportes de publicaciones</h2>
          <form method="get" className="row">
            <select name="estado" className="select" aria-label="Estado" defaultValue={pstatus} style={{ maxWidth: 200 }}><Options map={PROPERTY_REPORT_STATUSES} empty="Abiertos y en revisión" /></select>
            <button className="btn btn-ghost btn-sm" type="submit">Ver</button>
          </form>
        </div>
        {prs.error && <p className="alert alert-error">No se pudieron cargar los reportes.</p>}
        {pRows.length === 0 ? <Empty>No hay reportes.</Empty> : pRows.map((r) => (
          <article key={r.id} className="card card-body stack">
            <div>
              <Badge value={r.status} map={PROPERTY_REPORT_STATUSES} /> <strong>{labelOf(REPORT_REASONS, r.reason)}</strong> ·{" "}
              {r.properties ? <Link href={`/admin/inmuebles/${r.property_id}`}>{r.properties.code} · {r.properties.title}</Link> : "Publicación eliminada"}
              <div className="xs muted">{formatDate(r.created_at, true)} · {r.reporter_id ? labelFor(people, r.reporter_id) : "Visitante"}{r.contact_email ? ` · ${r.contact_email}` : ""}</div>
            </div>
            {r.details && <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.details}</p>}
            {r.resolution && <p className="small">Resolución: {r.resolution} {r.resolved_by && `(${labelFor(people, r.resolved_by)})`}</p>}
            {["abierto", "en_revision"].includes(r.status) && (
              <ActionForm action={updatePropertyReport} submit="Guardar" buttonClass="btn btn-primary btn-sm" inline>
                <input type="hidden" name="id" value={r.id} />
                <select name="status" className="select" aria-label="Nuevo estado" defaultValue="resuelto" style={{ maxWidth: 170 }}>
                  {r.status === "abierto" && <option value="en_revision">En revisión</option>}
                  <option value="resuelto">Resuelto</option><option value="descartado">Descartado</option>
                </select>
                <input name="resolution" className="input" maxLength={2000} placeholder="Resolución (obligatoria al cerrar)" aria-label="Resolución" style={{ maxWidth: 360 }} />
              </ActionForm>
            )}
          </article>
        ))}
        <Pagination base={BASE} sp={sp} page={page} total={prs.count ?? 0} pageSize={pageSize} />
        <p className="xs muted">Para pausar o rechazar la publicación reportada, ábrala y use las acciones de revisión (siempre con motivo).</p>
      </section>

      <hr className="divider" />
      <section className="stack">
        <div className="row-between">
          <h2>Reportes de mensajes</h2>
          <form method="get" className="row">
            {pstatus && <input type="hidden" name="estado" value={pstatus} />}
            <select name="estado_mensajes" className="select" aria-label="Estado" defaultValue={mstatus} style={{ maxWidth: 200 }}><Options map={MESSAGE_REPORT_STATUSES} empty="Abiertos" /></select>
            <button className="btn btn-ghost btn-sm" type="submit">Ver</button>
          </form>
        </div>
        {mRows.length === 0 ? <Empty>No hay reportes de mensajes.</Empty> : mRows.map((r) => (
          <article key={r.id} className="card card-body stack">
            <div>
              <Badge value={r.status} map={MESSAGE_REPORT_STATUSES} /> Reportado por {labelFor(people, r.reporter_id)} · {formatDate(r.created_at, true)}
              {r.messages && <> · <Link href={`/admin/mensajes/${r.messages.conversation_id}`}>ver conversación</Link></>}
            </div>
            <p className="small" style={{ margin: 0 }}>Motivo: {r.reason}</p>
            {r.messages && <blockquote className="box small" style={{ margin: 0 }}>{r.messages.body}<div className="xs muted">— {labelFor(people, r.messages.sender_id)}{r.messages.hidden ? " · oculto" : ""}</div></blockquote>}
            {r.status === "abierto" ? (
              <ActionForm action={resolveMessageReport} submit="Cerrar reporte" buttonClass="btn btn-primary btn-sm" inline>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={BASE} />
                <select name="status" className="select" aria-label="Resultado" defaultValue="resuelto" style={{ maxWidth: 160 }}><option value="resuelto">Resuelto</option><option value="descartado">Descartado</option></select>
                <input name="resolution" className="input" required minLength={3} maxLength={2000} placeholder="Resolución" aria-label="Resolución" style={{ maxWidth: 360 }} />
              </ActionForm>
            ) : <p className="small">Resolución: {r.resolution} ({labelFor(people, r.resolved_by)})</p>}
          </article>
        ))}
        <p className="xs muted">Para ocultar el mensaje, ábralo en la conversación (se exige motivo).</p>
      </section>
    </>
  );
}
