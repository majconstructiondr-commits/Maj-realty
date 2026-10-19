import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import { labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, publisherMembers, staffCtx, staffMembers, userLabels } from "@/lib/admin/server";
import { isoToLocalInput } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";
import { addRequestNote, startRequestConversation, updateRequest } from "../actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

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
  const i = (await getI18n()).d;
  const S = i.status;
  const cm = i.admin.common;
  const t = i.admin.reqDetail;
  const { data } = await supabase.from("service_requests").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Req;

  const legalCodes = [
    ...(Array.isArray(r.details?.service_codes) ? (r.details.service_codes as unknown[]).map(String) : []),
    ...(typeof r.details?.service_code === "string" ? [r.details.service_code] : []),
  ];
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
    r.kind === "legal" ? supabase.from("legal_services").select("code, name, responsible_professional").in("code", legalCodes) : Promise.resolve({ data: null }),
  ]);
  const evRows = (events.data ?? []) as Ev[];
  const assignIds = evRows.filter((e) => e.kind === "asignacion").flatMap((e) => [...(e.from_value ?? "").split("/"), ...(e.to_value ?? "").split("/")]);
  const people = await userLabels(supabase, [r.client_user_id, r.assigned_to, r.assigned_publisher_id, ...evRows.map((e) => e.actor_id), ...assignIds.filter(isUuid)]);
  const property = prop.data as { id: string; code: string; title: string; status: string } | null;
  const assignText = (v: string | null) => {
    const [a, b] = (v ?? "/").split("/");
    return fmt(t.assignText, { maj: a ? labelFor(people, a) : "—", pub: b ? labelFor(people, b) : "—" });
  };
  const eventText = (e: Ev) => {
    switch (e.kind) {
      case "estado": return `${labelOf(S.requestStatuses, e.from_value)} → ${labelOf(S.requestStatuses, e.to_value)}`;
      case "etapa": return `${labelOf(S.crmStages, e.from_value)} → ${labelOf(S.crmStages, e.to_value)}`;
      case "asignacion": return `${assignText(e.from_value)} ⟶ ${assignText(e.to_value)}`;
      case "proxima_accion": return `${e.body ?? t.noNextAction}${e.to_value ? ` · ${e.to_value}` : ""}`;
      case "creada": return fmt(t.initialStatus, { status: labelOf(S.requestStatuses, e.to_value) });
      default: return e.body ?? "";
    }
  };
  const legalSvcs = new Map(((legal.data ?? []) as { code: string; name: string; responsible_professional: string | null }[]).map((s) => [s.code, s]));
  const svcLabel = (code: string) => {
    const s = legalSvcs.get(code);
    return s ? `${s.name}${s.responsible_professional ? ` ${fmt(t.responsible, { name: s.responsible_professional })}` : ""}` : code;
  };
  const details = { ...r.details };
  if (Array.isArray(details.service_codes)) {
    details.service_codes = (details.service_codes as unknown[]).map((c) => svcLabel(String(c))).join("\n");
    delete details.service_code;
  } else if (typeof details.service_code === "string") details.service_code = svcLabel(details.service_code);

  return (
    <>
      <PageHeader title={fmt(t.title, { n: r.number })} back={{ href: "/admin/solicitudes", label: t.back }}>
        <Badge value={r.status} map={S.requestStatuses} />
        <Badge value={r.stage} map={S.crmStages} />
        {r.is_demo && <span className="badge badge-demo">{t.demo}</span>}
        <Link className="btn btn-ghost btn-sm" href={`/admin/cotizaciones/nueva?solicitud=${r.id}`}>{t.createQuote}</Link>
      </PageHeader>
      <p className="small muted">{labelOf(S.requestKinds, r.kind)} · {fmt(t.meta, { received: formatDate(r.created_at, true), source: r.source, updated: formatDate(r.updated_at, true) })}</p>

      <div className="grid-2">
        <section className="card card-body stack">
          <h2>{t.contact}</h2>
          <DetailBoxes data={{
            [t.name]: r.contact_name,
            [t.email]: r.contact_email,
            [t.phone]: r.contact_phone,
            [t.channel]: labelOf(i.labels.channels, r.preferred_channel),
            [t.account]: r.client_user_id ? `${labelFor(people, r.client_user_id)}${people.get(r.client_user_id)?.email ? ` · ${people.get(r.client_user_id)?.email}` : ""}` : t.visitor,
            [t.contactConsent]: r.contact_consent,
            [t.marketingConsent]: r.marketing_consent,
          }} />
          {r.client_user_id && <Link href={`/admin/usuarios/${r.client_user_id}`} className="small">{t.viewUser}</Link>}
          {(consents.data ?? []).length > 0 && (
            <p className="xs muted">{t.consents} {((consents.data ?? []) as { kind: string; granted: boolean; document_version: string }[]).map((c) => `${c.kind}: ${(c.granted ? cm.yes : cm.no).toLowerCase()} (v. ${c.document_version})`).join(" · ")}</p>
          )}
        </section>
        <section className="card card-body stack">
          <h2>{t.management}</h2>
          <ActionForm action={updateRequest} submit={t.saveChanges}>
            <input type="hidden" name="id" value={r.id} />
            <div className="form-grid">
              <div className="field"><label htmlFor="u-status">{t.status}</label><select id="u-status" name="status" className="select" defaultValue={r.status}>{Object.entries(S.requestStatuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label htmlFor="u-stage">{t.stage}</label><select id="u-stage" name="stage" className="select" defaultValue={r.stage}>{Object.entries(S.crmStages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field">
                <label htmlFor="u-as">{t.majAssignee}</label>
                <select id="u-as" name="assigned_to" className="select" defaultValue={r.assigned_to ?? ""}>
                  <option value="">{t.unassigned}</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="u-pub">{t.publisher}</label>
                <select id="u-pub" name="assigned_publisher_id" className="select" defaultValue={r.assigned_publisher_id ?? ""}>
                  <option value="">{t.none}</option>
                  {publishers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <span className="hint">{t.publisherHint}</span>
              </div>
              <div className="field"><label htmlFor="u-na">{t.nextAction}</label><input id="u-na" name="next_action" className="input" maxLength={300} defaultValue={r.next_action ?? ""} /></div>
              <div className="field"><label htmlFor="u-nat">{t.dateSD}</label><input id="u-nat" type="datetime-local" name="next_action_at" className="input" defaultValue={isoToLocalInput(r.next_action_at)} /></div>
            </div>
          </ActionForm>
        </section>
      </div>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{t.details}</h2>
        {property ? (
          <p>{t.property} <Link href={`/admin/inmuebles/${property.id}`}>{property.code} · {property.title}</Link> ({labelOf(S.listing, property.status)})</p>
        ) : r.property_ref ? <p>{t.reference} {r.property_ref}</p> : null}
        {r.message && <div className="box"><span className="box-label">{t.message}</span><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{r.message}</p></div>}
        <DetailBoxes data={details} labels={S.detailLabels} />
        <h3>{t.files}</h3>
        {(files.data ?? []).length === 0 ? <p className="muted small">{t.noFiles}</p> : (
          <ul>
            {((files.data ?? []) as { id: string; storage_path: string; file_name: string; size_bytes: number; created_at: string }[]).map((f) => (
              <li key={f.id}><FileLink path={f.storage_path}>{f.file_name}</FileLink> <span className="xs muted">· {Math.ceil(f.size_bytes / 1024)} KB · {formatDate(f.created_at, true)}</span></li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>{t.history}</h2>
          <ActionForm action={addRequestNote} submit={t.addNote} resetOnSuccess>
            <input type="hidden" name="id" value={r.id} />
            <div className="field"><label htmlFor="note" className="required">{t.note}</label><textarea id="note" name="body" className="textarea" required minLength={2} maxLength={4000} /></div>
            <label className="check"><input type="checkbox" name="visible" /> {t.visibleCheck}</label>
          </ActionForm>
          <ul className="timeline">
            {evRows.map((e) => (
              <li key={e.id}>
                <strong>{labelOf(S.requestEvents, e.kind)}</strong>{" "}
                {e.is_private ? <span className="badge">{t.private}</span> : <span className="badge badge-gold">{t.visible}</span>}
                <div className="small" style={{ whiteSpace: "pre-wrap" }}>{eventText(e)}</div>
                <div className="xs muted">{formatDate(e.created_at, true)} · {labelFor(people, e.actor_id, t.systemVisitor)}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card card-body stack">
          <h2>{t.related}</h2>
          <h3>{t.quotes}</h3>
          {(quotes.data ?? []).length === 0 ? <p className="small muted">{t.noneF}</p> : (
            <ul>{((quotes.data ?? []) as { id: string; number: string; title: string; status: string }[]).map((q) => (
              <li key={q.id}><Link href={`/admin/cotizaciones/${q.id}`}>{q.number}</Link> · {q.title} · {labelOf(S.quote, q.status)}</li>
            ))}</ul>
          )}
          <h3>{t.visits}</h3>
          {(appts.data ?? []).length === 0 ? <p className="small muted">{t.noneF}</p> : (
            <ul>{((appts.data ?? []) as { id: string; starts_at: string; status: string }[]).map((a) => (
              <li key={a.id}>{formatDate(a.starts_at, true)} · {labelOf(S.appointment, a.status)}</li>
            ))}</ul>
          )}
          <h3>{t.conversations}</h3>
          {((convs.data ?? []) as { id: string; subject: string; status: string }[]).map((c) => (
            <p key={c.id} className="small"><Link href={`/admin/mensajes/${c.id}`}>{c.subject}</Link> · {labelOf(S.conversations, c.status)}</p>
          ))}
          {r.client_user_id ? (
            <ActionForm action={startRequestConversation} submit={t.startConv}>
              <input type="hidden" name="id" value={r.id} />
              <div className="field"><label htmlFor="cv-s" className="required">{t.subject}</label><input id="cv-s" name="subject" className="input" required maxLength={160} defaultValue={`Solicitud ${r.number}`} /></div>
              <div className="field"><label htmlFor="cv-b">{t.firstMessage}</label><textarea id="cv-b" name="body" className="textarea" maxLength={4000} /></div>
              <p className="xs muted">{t.convNote}</p>
            </ActionForm>
          ) : <p className="small muted">{t.noAccount}</p>}
        </section>
      </div>
    </>
  );
}
