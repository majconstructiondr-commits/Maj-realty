import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink, PageHeader } from "@/components/admin/Bits";
import { CONVERSATION_STATUSES, MESSAGE_REPORT_STATUSES } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { hideMessage, resolveMessageReport, setConversationStatus, staffReply, unhideMessage } from "../actions";

type Msg = {
  id: string; sender_id: string; body: string; attachment_path: string | null; attachment_name: string | null; hidden: boolean;
  hidden_reason: string | null; hidden_by: string | null; created_at: string;
};
type Report = { id: string; message_id: string; reporter_id: string; reason: string; status: string; resolution: string | null; resolved_by: string | null; created_at: string };

export default async function ConversationModeration(props: PageProps<"/admin/mensajes/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase, user } = await staffCtx(`/admin/mensajes/${id}`);
  const { data: conv } = await supabase.from("conversations").select("*, properties(code, title), service_requests(number)").eq("id", id).maybeSingle();
  if (!conv) notFound();
  const [msgs, parts] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at").limit(500),
    supabase.from("conversation_participants").select("user_id, participant_role, last_read_at, joined_at").eq("conversation_id", id),
  ]);
  const messages = (msgs.data ?? []) as Msg[];
  const { data: reps } = messages.length
    ? await supabase.from("message_reports").select("*").in("message_id", messages.map((m) => m.id)).order("created_at", { ascending: false })
    : { data: [] };
  const reports = (reps ?? []) as Report[];
  const participants = (parts.data ?? []) as { user_id: string; participant_role: string; joined_at: string }[];
  const people = await userLabels(supabase, [...messages.map((m) => m.sender_id), ...messages.map((m) => m.hidden_by), ...participants.map((p) => p.user_id), ...reports.flatMap((r) => [r.reporter_id, r.resolved_by])]);
  const c = conv as { subject: string; status: string; property_id: string | null; request_id: string | null; properties: { code: string; title: string } | null; service_requests: { number: string } | null; created_at: string };
  const back = `/admin/mensajes/${id}`;

  return (
    <>
      <PageHeader title={c.subject} back={{ href: "/admin/mensajes", label: "Conversaciones" }}>
        <Badge value={c.status} map={CONVERSATION_STATUSES} />
      </PageHeader>
      <p className="small">
        {c.properties && <>Inmueble: <Link href={`/admin/inmuebles/${c.property_id}`}>{c.properties.code} · {c.properties.title}</Link> · </>}
        {c.service_requests && <>Solicitud: <Link href={`/admin/solicitudes/${c.request_id}`}>{c.service_requests.number}</Link> · </>}
        Participantes: {participants.map((p) => `${labelFor(people, p.user_id)} (${p.participant_role})`).join(", ")}
      </p>

      <div className="grid-2">
        <section className="card card-body stack">
          <h2>Mensajes</h2>
          {messages.length === 0 && <p className="muted">Sin mensajes.</p>}
          <div className="chat" style={{ maxHeight: "none" }}>
            {messages.map((m) => {
              const mr = reports.filter((r) => r.message_id === m.id);
              return (
                <div key={m.id} className={`bubble${m.sender_id === user.id ? " mine" : ""}`} style={m.hidden ? { opacity: 0.7, border: "1px dashed var(--danger)" } : undefined}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                  {m.attachment_path && <div className="small"><FileLink path={m.attachment_path}>{m.attachment_name ?? "Adjunto"}</FileLink></div>}
                  <div className="meta">{labelFor(people, m.sender_id)} · {formatDate(m.created_at, true)}{mr.length ? ` · ${mr.length} reporte(s)` : ""}</div>
                  {m.hidden ? (
                    <div className="small">
                      <strong>Oculto</strong>: {m.hidden_reason} ({labelFor(people, m.hidden_by)})
                      <ActionForm action={unhideMessage} submit="Volver a mostrar" buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="conversation_id" value={id} />
                      </ActionForm>
                    </div>
                  ) : (
                    <details className="small">
                      <summary>Ocultar</summary>
                      <ActionForm action={hideMessage} submit="Ocultar mensaje" buttonClass="btn btn-danger btn-sm">
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="conversation_id" value={id} />
                        <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder="Motivo" aria-label="Motivo para ocultar" />
                      </ActionForm>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
          {c.status === "abierta" && (
            <ActionForm action={staffReply} submit="Enviar como personal MAJ" resetOnSuccess>
              <input type="hidden" name="conversation_id" value={id} />
              <div className="field"><label htmlFor="rep">Responder</label><textarea id="rep" name="body" className="textarea" required maxLength={4000} /></div>
            </ActionForm>
          )}
        </section>
        <section className="card card-body stack">
          <h2>Moderación</h2>
          <ActionForm action={setConversationStatus} submit="Cambiar estado" buttonClass="btn btn-ghost btn-sm" inline>
            <input type="hidden" name="id" value={id} />
            <select name="status" className="select" aria-label="Estado" defaultValue={c.status} style={{ maxWidth: 200 }}>
              {Object.entries(CONVERSATION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </ActionForm>
          <h3>Reportes</h3>
          {reports.length === 0 ? <p className="small muted">Sin reportes.</p> : reports.map((r) => (
            <div key={r.id} className="box stack">
              <div><Badge value={r.status} map={MESSAGE_REPORT_STATUSES} /> <span className="small">{formatDate(r.created_at, true)} · {labelFor(people, r.reporter_id)}</span></div>
              <div className="small">Motivo: {r.reason}</div>
              <div className="xs muted">Mensaje: “{messages.find((m) => m.id === r.message_id)?.body.slice(0, 140)}”</div>
              {r.status === "abierto" ? (
                <ActionForm action={resolveMessageReport} submit="Cerrar reporte" buttonClass="btn btn-primary btn-sm">
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                  <select name="status" className="select" aria-label="Resultado" defaultValue="resuelto"><option value="resuelto">Resuelto</option><option value="descartado">Descartado</option></select>
                  <input name="resolution" className="input" required minLength={3} maxLength={2000} placeholder="Resolución" aria-label="Resolución" />
                </ActionForm>
              ) : <div className="small">Resolución: {r.resolution} ({labelFor(people, r.resolved_by)})</div>}
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
