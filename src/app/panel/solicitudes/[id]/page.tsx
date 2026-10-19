import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { downloadHref } from "@/lib/panel/download";
import { label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";
import { fmt, type Dictionary } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { CommentForm, StartChatButton } from "./RequestForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.request.meta };
}

function eventText(e: { kind: string; from_value: string | null; to_value: string | null; body: string | null }, d: Dictionary) {
  const S = d.status;
  if (e.kind === "estado") return `${label(S.requestStatuses, e.from_value)} → ${label(S.requestStatuses, e.to_value)}`;
  if (e.kind === "etapa") return `${label(S.crmStages, e.from_value)} → ${label(S.crmStages, e.to_value)}`;
  if (e.kind === "creada") return fmt(d.panel.request.initialStatus, { status: label(S.requestStatuses, e.to_value) });
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
  const { d } = await getI18n();
  const t = d.panel.request;

  const [events, files, quotes] = await Promise.all([
    supabase.from("request_events").select("id, kind, from_value, to_value, body, actor_id, created_at")
      .eq("request_id", id).eq("is_private", false).order("created_at"),
    supabase.from("request_files").select("id, file_name, mime_type, size_bytes, created_at").eq("request_id", id).order("created_at"),
    supabase.from("quotes").select("id, number, title, status").eq("request_id", id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/solicitudes">{t.breadcrumb}</Link> / <span aria-current="page">{r.number}</span>
      </nav>
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{fmt(t.title, { number: r.number })}</h1>
        <span className={statusBadge(r.status)}>{label(d.status.requestStatuses, r.status)}</span>
      </div>

      <section className="card card-body">
        <div className="grid-2">
          <div className="box"><span className="box-label">{t.kind}</span><span className="box-value">{label(d.status.requestKinds, r.kind)}</span></div>
          <div className="box"><span className="box-label">{t.date}</span><span className="box-value">{formatDate(r.created_at, true)}</span></div>
          <div className="box"><span className="box-label">{t.channel}</span><span className="box-value">{label(d.labels.channels, r.preferred_channel)}</span></div>
          {r.property_ref ? <div className="box"><span className="box-label">{t.property}</span><span className="box-value">{r.property_ref}</span></div> : null}
        </div>
        {r.message ? (
          <>
            <h2 className="small" style={{ marginTop: 16 }}>{t.message}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
          </>
        ) : null}
        {isClient ? <div style={{ marginTop: 12 }}><StartChatButton requestId={r.id} /></div> : null}
      </section>

      {quotes.data?.length ? (
        <section className="card card-body" aria-labelledby="req-quotes">
          <h2 id="req-quotes" style={{ marginTop: 0 }}>{t.quotes}</h2>
          <ul>
            {quotes.data.map((q) => (
              <li key={q.id}><Link href={`/panel/cotizaciones/${q.id}`}>{q.number}</Link> · {q.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card card-body" aria-labelledby="req-files">
        <h2 id="req-files" style={{ marginTop: 0 }}>{t.files}</h2>
        {files.data?.length ? (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {files.data.map((f) => (
              <li key={f.id} className="row-between">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {f.file_name} <span className="xs muted">({formatNumber(f.size_bytes / 1024)} KB · {formatDate(f.created_at)})</span>
                </span>
                <a className="btn btn-ghost btn-sm" href={downloadHref("archivo", f.id)} aria-label={fmt(d.panel.shared.downloadNamed, { name: f.file_name })}>{d.panel.shared.download}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t.noFiles}</p>
        )}
        <p className="xs muted">{t.filesNote}</p>
      </section>

      <section className="card card-body" aria-labelledby="req-history">
        <h2 id="req-history" style={{ marginTop: 0 }}>{d.panel.shared.history}</h2>
        {events.data?.length ? (
          <ol className="timeline">
            {events.data.map((e) => (
              <li key={e.id}>
                <strong>{label(d.status.clientRequestEvents, e.kind)}</strong>
                {e.kind === "nota_cliente" ? <span className="xs muted"> · {e.actor_id === u.id ? d.panel.shared.you : d.panel.shared.team}</span> : null}
                <div className="small" style={{ whiteSpace: "pre-wrap" }}>{eventText(e, d)}</div>
                <span className="xs muted">{formatDate(e.created_at, true)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted">{t.noMovements}</p>
        )}
        <div style={{ marginTop: 16 }}>
          <CommentForm requestId={r.id} />
        </div>
      </section>
    </div>
  );
}
