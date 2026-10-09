import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, Options, PageHeader } from "@/components/admin/Bits";
import { APPOINTMENT_KINDS, APPOINTMENT_STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid, oneOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, staffMembers, userLabels } from "@/lib/admin/server";
import { addDays, isoToLocalInput, localDay, localDayStartIso } from "@/lib/admin/time";
import { formatDateLong } from "@/lib/format";
import { updateAppointment } from "./actions";

const BASE = "/admin/visitas";
type Appt = {
  id: string; starts_at: string; ends_at: string; status: string; kind: string; client_id: string | null; agent_id: string;
  client_notes: string | null; cancel_reason: string | null; request_id: string | null; property_id: string | null;
  properties: { code: string; title: string; sector: string; municipality: string } | null;
};

const time = (iso: string) => new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));

export default async function AdminVisits(props: PageProps<"/admin/visitas">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const today = localDay(new Date());
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(str(sp, "desde")) ? str(sp, "desde") : today;
  const dias = [1, 7, 14, 30].includes(Number(str(sp, "dias"))) ? Number(str(sp, "dias")) : 7;
  const status = oneOf(sp, "status", Object.keys(APPOINTMENT_STATUSES));
  const agente = str(sp, "agente");

  let q = supabase.from("appointments")
    .select("id, starts_at, ends_at, status, kind, client_id, agent_id, client_notes, cancel_reason, request_id, property_id, properties(code, title, sector, municipality)")
    .gte("starts_at", localDayStartIso(desde)).lt("starts_at", localDayStartIso(addDays(desde, dias)))
    .order("starts_at").limit(500);
  if (status) q = q.eq("status", status);
  if (isUuid(agente)) q = q.eq("agent_id", agente);
  const [{ data, error }, staff] = await Promise.all([q, staffMembers(supabase)]);
  const rows = (data ?? []) as unknown as Appt[];
  const people = await userLabels(supabase, rows.flatMap((a) => [a.client_id, a.agent_id]));
  const byDay = new Map<string, Appt[]>();
  for (const a of rows) {
    const d = localDay(a.starts_at);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }
  const nav = (d: string) => `${BASE}?desde=${d}&dias=${dias}${status ? `&status=${status}` : ""}${agente ? `&agente=${agente}` : ""}`;

  return (
    <>
      <PageHeader title="Visitas y citas">
        <Link className="btn btn-ghost btn-sm" href={nav(addDays(desde, -dias))}>‹ Anterior</Link>
        <Link className="btn btn-ghost btn-sm" href={nav(today)}>Hoy</Link>
        <Link className="btn btn-ghost btn-sm" href={nav(addDays(desde, dias))}>Siguiente ›</Link>
      </PageHeader>
      <p className="small muted">Horas en zona de Santo Domingo. Reprogramar valida el horario de atención y evita dobles reservas del asesor.</p>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }}>
        <div className="field"><label htmlFor="v-d">Desde</label><input id="v-d" type="date" name="desde" className="input" defaultValue={desde} /></div>
        <div className="field"><label htmlFor="v-n">Período</label><select id="v-n" name="dias" className="select" defaultValue={String(dias)}><option value="1">1 día</option><option value="7">7 días</option><option value="14">14 días</option><option value="30">30 días</option></select></div>
        <div className="field"><label htmlFor="v-s">Estado</label><select id="v-s" name="status" className="select" defaultValue={status}><Options map={APPOINTMENT_STATUSES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="v-a">Asesor</label><select id="v-a" name="agente" className="select" defaultValue={agente}><option value="">Todos</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="row"><button className="btn btn-primary" type="submit">Ver</button></div>
      </form>
      {error && <p className="alert alert-error">No se pudieron cargar las citas.</p>}
      {rows.length === 0 ? <Empty>No hay citas en este período.</Empty> : [...byDay.entries()].map(([day, list]) => (
        <section key={day} className="stack" style={{ marginBottom: 20 }}>
          <h2 style={{ textTransform: "capitalize" }}>{formatDateLong(day)}{day === today ? " · hoy" : ""}</h2>
          {list.map((a) => (
            <article key={a.id} className="card card-body stack">
              <div className="row-between">
                <div>
                  <strong>{time(a.starts_at)} – {time(a.ends_at)}</strong> · {labelOf(APPOINTMENT_KINDS, a.kind)} <Badge value={a.status} map={APPOINTMENT_STATUSES} />
                  <div className="small">
                    {a.properties ? <Link href={`/admin/inmuebles/${a.property_id}`}>{a.properties.code} · {a.properties.title}</Link> : null}
                    {a.request_id && <> · <Link href={`/admin/solicitudes/${a.request_id}`}>solicitud</Link></>}
                  </div>
                  <div className="small muted">Cliente: {labelFor(people, a.client_id)}{people.get(a.client_id ?? "")?.email ? ` (${people.get(a.client_id ?? "")?.email})` : ""} · Asesor: {labelFor(people, a.agent_id)}</div>
                  {a.client_notes && <div className="small">Nota del cliente: {a.client_notes}</div>}
                  {a.cancel_reason && <div className="small">Motivo de cancelación: {a.cancel_reason}</div>}
                </div>
              </div>
              {["solicitada", "confirmada"].includes(a.status) && (
                <div className="grid-3">
                  {a.status === "solicitada" && (
                    <ActionForm action={updateAppointment} submit="Confirmar" buttonClass="btn btn-primary btn-sm">
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="confirmar" />
                    </ActionForm>
                  )}
                  {a.status === "confirmada" && (
                    <div className="row">
                      <ActionForm action={updateAppointment} submit="Completada" buttonClass="btn btn-primary btn-sm">
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="completar" />
                      </ActionForm>
                      <ActionForm action={updateAppointment} submit="No asistió" buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="no_asistio" />
                      </ActionForm>
                    </div>
                  )}
                  <ActionForm action={updateAppointment} submit="Reprogramar" buttonClass="btn btn-outline btn-sm">
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="reprogramar" />
                    <label className="small" htmlFor={`rp-${a.id}`}>Nueva fecha y hora</label>
                    <input id={`rp-${a.id}`} type="datetime-local" name="new_start" className="input" required defaultValue={isoToLocalInput(a.starts_at)} />
                  </ActionForm>
                  <ActionForm action={updateAppointment} submit="Cancelar visita" buttonClass="btn btn-danger btn-sm">
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="op" value="cancelar" />
                    <label className="small" htmlFor={`cn-${a.id}`}>Motivo</label>
                    <input id={`cn-${a.id}`} name="reason" className="input" required minLength={3} maxLength={500} />
                  </ActionForm>
                </div>
              )}
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
