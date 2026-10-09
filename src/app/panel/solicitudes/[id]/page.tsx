import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CHANNELS, CRM_STAGES, REQUEST_KINDS, REQUEST_STATUSES } from "@/lib/catalog/definitions";
import { formatDate, formatNumber } from "@/lib/format";
import { downloadHref } from "@/lib/panel/download";
import { label, REQUEST_EVENT_KINDS, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";
import { CommentForm, StartChatButton } from "./RequestForms";

export const metadata: Metadata = { title: "Solicitud" };

function eventText(e: { kind: string; from_value: string | null; to_value: string | null; body: string | null }) {
  if (e.kind === "estado") return `${label(REQUEST_STATUSES, e.from_value)} → ${label(REQUEST_STATUSES, e.to_value)}`;
  if (e.kind === "etapa") return `${label(CRM_STAGES, e.from_value)} → ${label(CRM_STAGES, e.to_value)}`;
  if (e.kind === "creada") return `Estado inicial: ${label(REQUEST_STATUSES, e.to_value)}`;
  return e.body ?? "";
}

export default async function Page(props: PageProps<"/panel/solicitudes/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const u = await requireUser(`/panel/solicitudes/${id}`);
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("service_requests")
    .select("id, number, kind, status, client_user_id, contact_name, contact_email, contact_phone, preferred_channel, property_ref, message, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const isClient = r.client_user_id === u.id;

  const [events, files, quotes] = await Promise.all([
    supabase.from("request_events").select("id, kind, from_value, to_value, body, actor_id, created_at")
      .eq("request_id", id).eq("is_private", false).order("created_at"),
    supabase.from("request_files").select("id, file_name, mime_type, size_bytes, created_at").eq("request_id", id).order("created_at"),
    supabase.from("quotes").select("id, number, title, status").eq("request_id", id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label="Ruta" className="small muted">
        <Link href="/panel/solicitudes">Mis solicitudes</Link> / <span aria-current="page">{r.number}</span>
      </nav>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Solicitud {r.number}</h1>
        <span className={statusBadge(r.status)}>{label(REQUEST_STATUSES, r.status)}</span>
      </div>

      <section className="card card-body">
        <div className="grid-2">
          <div className="box"><span className="box-label">Tipo</span><span className="box-value">{label(REQUEST_KINDS, r.kind)}</span></div>
          <div className="box"><span className="box-label">Fecha</span><span className="box-value">{formatDate(r.created_at, true)}</span></div>
          <div className="box"><span className="box-label">Canal preferido</span><span className="box-value">{label(CHANNELS, r.preferred_channel)}</span></div>
          {r.property_ref ? <div className="box"><span className="box-label">Inmueble</span><span className="box-value">{r.property_ref}</span></div> : null}
        </div>
        {r.message ? (
          <>
            <h2 className="small" style={{ marginTop: 16 }}>Mensaje enviado</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
          </>
        ) : null}
        {isClient ? <div style={{ marginTop: 12 }}><StartChatButton requestId={r.id} /></div> : null}
      </section>

      {quotes.data?.length ? (
        <section className="card card-body" aria-labelledby="req-quotes">
          <h2 id="req-quotes" style={{ marginTop: 0 }}>Cotizaciones</h2>
          <ul>
            {quotes.data.map((q) => (
              <li key={q.id}><Link href={`/panel/cotizaciones/${q.id}`}>{q.number}</Link> · {q.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card card-body" aria-labelledby="req-files">
        <h2 id="req-files" style={{ marginTop: 0 }}>Archivos</h2>
        {files.data?.length ? (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {files.data.map((f) => (
              <li key={f.id} className="row-between">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {f.file_name} <span className="xs muted">({formatNumber(f.size_bytes / 1024)} KB · {formatDate(f.created_at)})</span>
                </span>
                <a className="btn btn-ghost btn-sm" href={downloadHref("archivo", f.id)} aria-label={`Descargar ${f.file_name}`}>Descargar</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">No hay archivos adjuntos.</p>
        )}
        <p className="xs muted">Los archivos son privados; el enlace de descarga se genera al momento y vence en un minuto.</p>
      </section>

      <section className="card card-body" aria-labelledby="req-history">
        <h2 id="req-history" style={{ marginTop: 0 }}>Historial</h2>
        {events.data?.length ? (
          <ol className="timeline">
            {events.data.map((e) => (
              <li key={e.id}>
                <strong>{label(REQUEST_EVENT_KINDS, e.kind)}</strong>
                {e.kind === "nota_cliente" ? <span className="xs muted"> · {e.actor_id === u.id ? "Usted" : "Equipo MAJ"}</span> : null}
                <div className="small" style={{ whiteSpace: "pre-wrap" }}>{eventText(e)}</div>
                <span className="xs muted">{formatDate(e.created_at, true)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted">Sin movimientos todavía.</p>
        )}
        <div style={{ marginTop: 16 }}>
          <CommentForm requestId={r.id} />
        </div>
      </section>
    </div>
  );
}
