import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { bookingWindow } from "@/lib/panel/appointments";
import { APPOINTMENT_KINDS, APPOINTMENT_STATUSES, label, statusBadge } from "@/lib/panel/labels";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { AppointmentActions } from "./AppointmentActions";

export const metadata: Metadata = { title: "Visitas" };

type Appt = {
  id: string; kind: string; starts_at: string; ends_at: string; status: string; client_id: string | null; agent_id: string;
  property_id: string | null; request_id: string | null; client_notes: string | null; cancel_reason: string | null;
};

export default async function Page(props: PageProps<"/panel/visitas">) {
  const sp = await props.searchParams;
  const u = await requireUser("/panel/visitas");
  const supabase = await createClient();
  const s = await getSiteSettings();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, kind, starts_at, ends_at, status, client_id, agent_id, property_id, request_id, client_notes, cancel_reason")
    .or(`client_id.eq.${u.id},agent_id.eq.${u.id}`)
    .order("starts_at", { ascending: false })
    .limit(200);
  const appts = (data ?? []) as Appt[];

  const propIds = [...new Set(appts.map((a) => a.property_id).filter(Boolean))] as string[];
  const { data: props_ } = propIds.length ? await supabase.from("catalog").select("id, code, slug, title").in("id", propIds) : { data: [] };
  const propMap = new Map((props_ ?? []).map((p) => [p.id as string, p as { id: string; code: string; slug: string; title: string }]));

  const otherIds = [...new Set(appts.map((a) => (a.agent_id === u.id ? a.client_id : a.agent_id)).filter((x): x is string => Boolean(x) && x !== u.id))];
  const names = new Map<string, string>();
  await Promise.all(otherIds.map(async (id) => {
    const { data: n } = await supabase.rpc("public_name", { p_user: id });
    if (n) names.set(id, String(n));
  }));

  const lead = Number(s["appointments.min_lead_hours"]) || 12;
  const { nowMs: now, minDate, maxDate } = bookingWindow(lead);
  const duration = Number(s["appointments.duration_minutes"]) || 60;
  const upcoming = appts.filter((a) => new Date(a.ends_at).getTime() >= now && ["solicitada", "confirmada"].includes(a.status)).reverse();
  const history = appts.filter((a) => !upcoming.includes(a));

  const renderList = (list: Appt[]) => (
    <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
      {list.map((a) => {
        const p = a.property_id ? propMap.get(a.property_id) : undefined;
        const isAgent = a.agent_id === u.id;
        const other = isAgent ? a.client_id : a.agent_id;
        return (
          <li key={a.id} className="card card-body">
            <div className="row-between">
              <div>
                <strong>{formatDate(a.starts_at, true)}</strong> · {label(APPOINTMENT_KINDS, a.kind)}
                <div className="small">
                  {p ? <Link href={listingHref(p)}>{p.title} ({p.code})</Link> : a.request_id ? <Link href={`/panel/solicitudes/${a.request_id}`}>Ver solicitud</Link> : null}
                </div>
                <div className="xs muted">
                  {isAgent ? `Usted es el asesor · Cliente: ${other ? names.get(other) ?? "—" : "—"}` : `Asesor: ${names.get(a.agent_id) ?? "Equipo MAJ"}`}
                </div>
                {a.client_notes ? <div className="xs">Notas: {a.client_notes}</div> : null}
                {a.cancel_reason ? <div className="xs">Motivo de cancelación: {a.cancel_reason}</div> : null}
              </div>
              <span className={statusBadge(a.status)}>{label(APPOINTMENT_STATUSES, a.status)}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <AppointmentActions
                id={a.id}
                status={a.status}
                isAgent={isAgent}
                isClient={a.client_id === u.id}
                past={new Date(a.starts_at).getTime() < now}
                hours={s["appointments.hours"]}
                duration={duration}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Visitas</h1>
      {sp.aviso === "solicitada" ? (
        <p className="alert alert-success" role="status">Solicitud de visita registrada. El asesor debe confirmarla; le avisaremos en sus notificaciones.</p>
      ) : null}
      <p className="small muted">Horarios en hora de Santo Domingo.</p>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus visitas.</p> : null}
      <section aria-labelledby="v-up">
        <h2 id="v-up">Próximas</h2>
        {upcoming.length ? renderList(upcoming) : (
          <div className="card empty">
            <p>No tiene visitas próximas. Puede agendar una desde la ficha de un inmueble.</p>
            <Link className="btn btn-primary" href="/venta">Ver inmuebles</Link>
          </div>
        )}
      </section>
      {history.length ? (
        <section aria-labelledby="v-hist">
          <h2 id="v-hist">Historial</h2>
          {renderList(history)}
        </section>
      ) : null}
    </div>
  );
}
