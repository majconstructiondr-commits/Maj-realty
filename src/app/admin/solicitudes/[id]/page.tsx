import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import {
  APPOINTMENT_STATUSES, CHANNELS, CRM_STAGES, DETAIL_LABELS, QUOTE_STATUSES, REQUEST_EVENT_KINDS, REQUEST_KINDS, REQUEST_STATUSES, labelOf,
} from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, publisherMembers, staffCtx, staffMembers, userLabels } from "@/lib/admin/server";
import { isoToLocalInput } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";
import { addRequestNote, startRequestConversation, updateRequest } from "../actions";

type Req = {
  id: string; number: string; kind: string; status: string; stage: string; client_user_id: string | null; contact_name: string;
  contact_email: string | null; contact_phone: string | null; preferred_channel: string; property_id: string | null; property_ref: string | null;
  message: string | null; details: Record<string, unknown>; source: string; assigned_to: string | null; assigned_publisher_id: string | null;
  next_action: string | null; next_action_at: string | null; contact_consent: boolean; marketing_consent: boolean; created_at: string;
  updated_at: string; is_demo: boolean;
};
type Ev = { id: number; kind: string; from_value: string | null; to_value: string | null; body: string | null; is_private: boolean; actor_id: string | null; created_at: string };

export default async function RequestDetail(props: PageProps<"/admin/solicitudes/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/solicitudes/${id}`);
  const { data } = await supabase.from("service_requests").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Req;

  const [events, files, quotes, convs, appts, consents, prop, staff, publishers, legal] = await Promise.all([
    supabase.from("request_events").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("request_files").select("*").eq("request_id", id).order("created_at"),
    supabase.from("quotes").select("id, number, title, status, currency, created_at").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, subject, status, last_message_at").eq("request_id", id).order("last_message_at", { ascending: false }),
    supabase.from("appointments").select("id, starts_at, status, kind").eq("request_id", id).order("starts_at", { ascending: false }),
    supabase.from("consents").select("kind, granted, document_version, created_at").eq("request_id", id),
    r.property_id ? supabase.from("properties").select("id, code, title, status").eq("id", r.property_id).maybeSingle() : Promise.resolve({ data: null }),
    staffMembers(supabase),
    publisherMembers(supabase),
    r.kind === "legal" && typeof r.details?.service_code === "string"
      ? supabase.from("legal_services").select("name, responsible_professional").eq("code", r.details.service_code as string).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const evRows = (events.data ?? []) as Ev[];
  const assignIds = evRows.filter((e) => e.kind === "asignacion").flatMap((e) => [...(e.from_value ?? "").split("/"), ...(e.to_value ?? "").split("/")]);
  const people = await userLabels(supabase, [r.client_user_id, r.assigned_to, r.assigned_publisher_id, ...evRows.map((e) => e.actor_id), ...assignIds.filter(isUuid)]);
  const property = prop.data as { id: string; code: string; title: string; status: string } | null;
  const assignText = (v: string | null) => {
    const [a, b] = (v ?? "/").split("/");
    return `MAJ: ${a ? labelFor(people, a) : "—"} · Publicador: ${b ? labelFor(people, b) : "—"}`;
  };
  const eventText = (e: Ev) => {
    switch (e.kind) {
      case "estado": return `${labelOf(REQUEST_STATUSES, e.from_value)} → ${labelOf(REQUEST_STATUSES, e.to_value)}`;
      case "etapa": return `${labelOf(CRM_STAGES, e.from_value)} → ${labelOf(CRM_STAGES, e.to_value)}`;
      case "asignacion": return `${assignText(e.from_value)} ⟶ ${assignText(e.to_value)}`;
      case "proxima_accion": return `${e.body ?? "Sin próxima acción"}${e.to_value ? ` · ${e.to_value}` : ""}`;
      case "creada": return `Estado inicial: ${labelOf(REQUEST_STATUSES, e.to_value)}`;
      default: return e.body ?? "";
    }
  };
  const legalSvc = legal.data as { name: string; responsible_professional: string | null } | null;
  const details = { ...r.details };
  if (legalSvc) details.service_code = `${legalSvc.name}${legalSvc.responsible_professional ? ` (responsable: ${legalSvc.responsible_professional})` : ""}`;

  return (
    <>
      <PageHeader title={`Solicitud ${r.number}`} back={{ href: "/admin/solicitudes", label: "Solicitudes" }}>
        <Badge value={r.status} map={REQUEST_STATUSES} />
        <Badge value={r.stage} map={CRM_STAGES} />
        {r.is_demo && <span className="badge badge-demo">Demostración</span>}
        <Link className="btn btn-ghost btn-sm" href={`/admin/cotizaciones/nueva?solicitud=${r.id}`}>Crear cotización</Link>
      </PageHeader>
      <p className="small muted">{labelOf(REQUEST_KINDS, r.kind)} · recibida {formatDate(r.created_at, true)} · origen {r.source} · actualizada {formatDate(r.updated_at, true)}</p>

      <div className="grid-2">
        <section className="card card-body stack">
          <h2>Contacto</h2>
          <DetailBoxes data={{
            Nombre: r.contact_name,
            Correo: r.contact_email,
            Teléfono: r.contact_phone,
            "Canal preferido": labelOf(CHANNELS, r.preferred_channel),
            "Cuenta registrada": r.client_user_id ? `${labelFor(people, r.client_user_id)}${people.get(r.client_user_id)?.email ? ` · ${people.get(r.client_user_id)?.email}` : ""}` : "No (visitante)",
            "Autoriza contacto": r.contact_consent,
            "Acepta comunicaciones comerciales": r.marketing_consent,
          }} />
          {r.client_user_id && <Link href={`/admin/usuarios/${r.client_user_id}`} className="small">Ver usuario</Link>}
          {(consents.data ?? []).length > 0 && (
            <p className="xs muted">Consentimientos: {((consents.data ?? []) as { kind: string; granted: boolean; document_version: string }[]).map((c) => `${c.kind}: ${c.granted ? "sí" : "no"} (v. ${c.document_version})`).join(" · ")}</p>
          )}
        </section>
        <section className="card card-body stack">
          <h2>Gestión</h2>
          <ActionForm action={updateRequest} submit="Guardar cambios">
            <input type="hidden" name="id" value={r.id} />
            <div className="form-grid">
              <div className="field"><label htmlFor="u-status">Estado</label><select id="u-status" name="status" className="select" defaultValue={r.status}>{Object.entries(REQUEST_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label htmlFor="u-stage">Etapa</label><select id="u-stage" name="stage" className="select" defaultValue={r.stage}>{Object.entries(CRM_STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field">
                <label htmlFor="u-as">Responsable MAJ</label>
                <select id="u-as" name="assigned_to" className="select" defaultValue={r.assigned_to ?? ""}>
                  <option value="">Sin asignar</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="u-pub">Publicador asignado</label>
                <select id="u-pub" name="assigned_publisher_id" className="select" defaultValue={r.assigned_publisher_id ?? ""}>
                  <option value="">Ninguno</option>
                  {publishers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <span className="hint">El publicador verá los datos de contacto de esta solicitud.</span>
              </div>
              <div className="field"><label htmlFor="u-na">Próxima acción</label><input id="u-na" name="next_action" className="input" maxLength={300} defaultValue={r.next_action ?? ""} /></div>
              <div className="field"><label htmlFor="u-nat">Fecha (hora de Santo Domingo)</label><input id="u-nat" type="datetime-local" name="next_action_at" className="input" defaultValue={isoToLocalInput(r.next_action_at)} /></div>
            </div>
          </ActionForm>
        </section>
      </div>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Detalle de la solicitud</h2>
        {property ? (
          <p>Inmueble: <Link href={`/admin/inmuebles/${property.id}`}>{property.code} · {property.title}</Link> ({property.status})</p>
        ) : r.property_ref ? <p>Referencia: {r.property_ref}</p> : null}
        {r.message && <div className="box"><span className="box-label">Mensaje</span><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.message}</p></div>}
        <DetailBoxes data={details} labels={DETAIL_LABELS} />
        <h3>Archivos</h3>
        {(files.data ?? []).length === 0 ? <p className="muted small">Sin archivos.</p> : (
          <ul>
            {((files.data ?? []) as { id: string; storage_path: string; file_name: string; size_bytes: number; created_at: string }[]).map((f) => (
              <li key={f.id}><FileLink path={f.storage_path}>{f.file_name}</FileLink> <span className="xs muted">· {Math.ceil(f.size_bytes / 1024)} KB · {formatDate(f.created_at, true)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>Historial</h2>
          <ActionForm action={addRequestNote} submit="Agregar nota" resetOnSuccess>
            <input type="hidden" name="id" value={r.id} />
            <div className="field"><label htmlFor="note" className="required">Nota</label><textarea id="note" name="body" className="textarea" required minLength={2} maxLength={4000} /></div>
            <label className="check"><input type="checkbox" name="visible" /> Visible para el cliente (si no se marca, es privada del personal)</label>
          </ActionForm>
          <ul className="timeline">
            {evRows.map((e) => (
              <li key={e.id}>
                <strong>{labelOf(REQUEST_EVENT_KINDS, e.kind)}</strong>{" "}
                {e.is_private ? <span className="badge">Privada</span> : <span className="badge badge-gold">Visible al cliente</span>}
                <div className="small" style={{ whiteSpace: "pre-wrap" }}>{eventText(e)}</div>
                <div className="xs muted">{formatDate(e.created_at, true)} · {labelFor(people, e.actor_id, "Sistema / visitante")}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card card-body stack">
          <h2>Relacionado</h2>
          <h3>Cotizaciones</h3>
          {(quotes.data ?? []).length === 0 ? <p className="small muted">Ninguna.</p> : (
            <ul>{((quotes.data ?? []) as { id: string; number: string; title: string; status: string }[]).map((q) => (
              <li key={q.id}><Link href={`/admin/cotizaciones/${q.id}`}>{q.number}</Link> · {q.title} · {labelOf(QUOTE_STATUSES, q.status)}</li>
            ))}</ul>
          )}
          <h3>Visitas y citas</h3>
          {(appts.data ?? []).length === 0 ? <p className="small muted">Ninguna.</p> : (
            <ul>{((appts.data ?? []) as { id: string; starts_at: string; status: string }[]).map((a) => (
              <li key={a.id}>{formatDate(a.starts_at, true)} · {labelOf(APPOINTMENT_STATUSES, a.status)}</li>
            ))}</ul>
          )}
          <h3>Conversaciones</h3>
          {((convs.data ?? []) as { id: string; subject: string; status: string }[]).map((c) => (
            <p key={c.id} className="small"><Link href={`/admin/mensajes/${c.id}`}>{c.subject}</Link> · {c.status}</p>
          ))}
          {r.client_user_id ? (
            <ActionForm action={startRequestConversation} submit="Iniciar conversación en la página">
              <input type="hidden" name="id" value={r.id} />
              <div className="field"><label htmlFor="cv-s" className="required">Asunto</label><input id="cv-s" name="subject" className="input" required maxLength={160} defaultValue={`Solicitud ${r.number}`} /></div>
              <div className="field"><label htmlFor="cv-b">Primer mensaje</label><textarea id="cv-b" name="body" className="textarea" maxLength={4000} /></div>
              <p className="xs muted">El cliente recibirá el mensaje en su panel. Esto no envía WhatsApp ni correo.</p>
            </ActionForm>
          ) : <p className="small muted">El chat de la página requiere que el cliente tenga cuenta. Contacte por el canal que indicó.</p>}
        </section>
      </div>
    </>
  );
}
