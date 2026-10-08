import Link from "next/link";
import { MoneyByCurrency, PageHeader } from "@/components/admin/Bits";
import { REQUEST_KINDS, STATUSES, labelOf } from "@/lib/admin/labels";
import { str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { isoFromNow } from "@/lib/admin/time";
import { formatDate, formatNumber, type Currency } from "@/lib/format";

type Totals = Partial<Record<Currency, { count: number; total: number | string }>>;
type Dash = {
  days: number;
  notice_days: number;
  properties_by_status: Record<string, number>;
  pending_change_requests: number;
  pending_media: number;
  pending_documents: number;
  licenses_expiring: number;
  licenses_pending: number;
  payments_pending: number;
  applications_pending: number;
  unattended_requests: number;
  open_requests_by_kind: Record<string, number>;
  open_property_reports: number;
  open_message_reports: number;
  upcoming_visits: number;
  visits_to_confirm: number;
  views: number;
  whatsapp_clicks: number;
  shares: number;
  saved_inquiries: number;
  closed_properties: number;
  closed_requests: number;
  quotes_accepted: Totals;
  quotes_open: Totals;
  payments_approved: Totals;
  management_balance: Partial<Record<Currency, { ingresos: number; egresos: number }>>;
};

function Stat({ label, value, href, hint }: { label: string; value: number | string; href?: string; hint?: string }) {
  const body = (
    <>
      <div className="num">{typeof value === "number" ? formatNumber(value) : value}</div>
      <div className="small">{label}</div>
      {hint && <div className="xs muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card stat" style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

const totalsOnly = (t: Totals) => Object.fromEntries(Object.entries(t).map(([c, v]) => [c, v?.total ?? 0])) as Partial<Record<Currency, number | string>>;

export default async function AdminDashboard(props: PageProps<"/admin">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx("/admin");
  const days = [7, 30, 90].includes(Number(str(sp, "dias"))) ? Number(str(sp, "dias")) : 30;
  const aviso = str(sp, "aviso");

  const [{ data, error }, { data: visits }, { data: oldest }] = await Promise.all([
    supabase.rpc("staff_dashboard", { p_days: days }),
    supabase
      .from("appointments")
      .select("id, starts_at, kind, status, property_id, properties(code, title)")
      .in("status", ["solicitada", "confirmada"])
      .gte("starts_at", isoFromNow(0))
      .order("starts_at")
      .limit(6),
    supabase
      .from("service_requests")
      .select("id, number, kind, contact_name, created_at")
      .eq("stage", "nuevo")
      .is("assigned_to", null)
      .not("status", "in", "(completada,cerrada,cancelada)")
      .lt("created_at", isoFromNow(-24))
      .order("created_at")
      .limit(6),
  ]);

  if (error || !data) {
    return (
      <>
        <PageHeader title="Tablero" />
        <p className="alert alert-error">No se pudieron cargar los indicadores. Verifique que su sesión tenga el segundo factor activo.</p>
      </>
    );
  }
  const d = data as Dash;
  const ps = d.properties_by_status ?? {};

  return (
    <>
      <PageHeader title="Tablero">
        {[7, 30, 90].map((n) => (
          <Link key={n} href={`/admin?dias=${n}`} className={`btn btn-sm ${n === days ? "btn-primary" : "btn-ghost"}`}>{n} días</Link>
        ))}
      </PageHeader>
      {aviso === "solo-administradores" && <p className="alert alert-warning">Esa sección es solo para administradores.</p>}

      <section className="stack" aria-labelledby="pendientes">
        <h2 id="pendientes">Pendientes de atención</h2>
        <div className="grid-4">
          <Stat label="Inmuebles en revisión" value={ps.en_revision ?? 0} href="/admin/inmuebles?status=en_revision" />
          <Stat label="Cambios pendientes" value={d.pending_change_requests} href="/admin/inmuebles?cambios=1" />
          <Stat label="Multimedia por aprobar" value={d.pending_media} href="/admin/inmuebles?multimedia=1" />
          <Stat label="Documentos por revisar" value={d.pending_documents} />
          <Stat label="Solicitudes sin atender (+24 h)" value={d.unattended_requests} href="/admin/solicitudes?stage=nuevo&asignado=ninguno" hint="Etapa nuevo, sin responsable" />
          <Stat label="Visitas por confirmar" value={d.visits_to_confirm} href="/admin/visitas?status=solicitada" />
          <Stat label="Próximas visitas (7 días)" value={d.upcoming_visits} href="/admin/visitas" />
          <Stat label="Reportes abiertos" value={d.open_property_reports + d.open_message_reports} href="/admin/reportes" hint={`${d.open_property_reports} de inmuebles · ${d.open_message_reports} de mensajes`} />
          <Stat label={`Licencias que vencen en ${d.notice_days} días`} value={d.licenses_expiring} href="/admin/licencias?vence=1" />
          <Stat label="Licencias pendientes" value={d.licenses_pending} href="/admin/licencias?status=pendiente" />
          <Stat label="Pagos por revisar" value={d.payments_pending} href="/admin/licencias#pagos" />
          <Stat label="Solicitudes de publicador" value={d.applications_pending} href="/admin/publicadores" />
        </div>
      </section>

      <hr className="divider" />
      <section className="stack" aria-labelledby="actividad">
        <h2 id="actividad">Actividad de los últimos {d.days} días</h2>
        <p className="small muted">
          Las vistas y los clics de WhatsApp miden interés: no son contactos confirmados ni ventas. Un cierre solo cuenta
          cuando el personal marca un inmueble como vendido/rentado o una solicitud en etapa de cierre.
        </p>
        <div className="grid-4">
          <Stat label="Vistas de fichas" value={d.views} hint="Una por sesión y día" />
          <Stat label="Clics en WhatsApp" value={d.whatsapp_clicks} hint="Abrir WhatsApp no confirma un mensaje" />
          <Stat label="Consultas guardadas" value={d.saved_inquiries} href="/admin/solicitudes" hint="Solicitudes registradas con número" />
          <Stat label="Cierres confirmados" value={d.closed_properties + d.closed_requests} hint={`${d.closed_properties} inmuebles vendidos/rentados · ${d.closed_requests} solicitudes en cierre`} />
        </div>
        <div className="grid-3">
          <div className="card stat">
            <div className="small">Cotizaciones aceptadas ({d.days} días)</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.quotes_accepted)} empty="Ninguna" /></div>
          </div>
          <div className="card stat">
            <div className="small">Cotizaciones enviadas pendientes de respuesta</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.quotes_open)} empty="Ninguna" /></div>
          </div>
          <div className="card stat">
            <div className="small">Pagos de licencia aprobados ({d.days} días)</div>
            <div className="box-value"><MoneyByCurrency totals={totalsOnly(d.payments_approved)} empty="Ninguno" /></div>
          </div>
        </div>
        {Object.keys(d.management_balance ?? {}).length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Administración de propiedades por moneda</caption>
              <thead><tr><th>Administración · moneda</th><th>Ingresos</th><th>Egresos</th></tr></thead>
              <tbody>
                {(Object.entries(d.management_balance) as [Currency, { ingresos: number; egresos: number }][]).map(([c, v]) => (
                  <tr key={c}>
                    <td>{c}</td>
                    <td><MoneyByCurrency totals={{ [c]: v.ingresos }} /></td>
                    <td><MoneyByCurrency totals={{ [c]: v.egresos }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="divider" />
      <div className="grid-2">
        <section className="stack">
          <h2>Inmuebles por estado</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Estado</th><th>Cantidad</th></tr></thead>
              <tbody>
                {Object.keys(STATUSES).map((s) => (
                  <tr key={s}>
                    <td><Link href={`/admin/inmuebles?status=${s}`}>{labelOf(STATUSES, s)}</Link></td>
                    <td>{formatNumber(ps[s] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="stack">
          <h2>Solicitudes abiertas por tipo</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tipo</th><th>Abiertas</th></tr></thead>
              <tbody>
                {Object.entries(d.open_requests_by_kind ?? {}).length === 0 && <tr><td colSpan={2} className="muted">Sin solicitudes abiertas</td></tr>}
                {Object.entries(d.open_requests_by_kind ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <tr key={k}><td><Link href={`/admin/solicitudes?kind=${k}`}>{labelOf(REQUEST_KINDS, k)}</Link></td><td>{formatNumber(n)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <hr className="divider" />
      <div className="grid-2">
        <section className="stack">
          <h2>Próximas visitas</h2>
          {(visits ?? []).length === 0 ? <p className="muted">No hay visitas programadas.</p> : (
            <ul className="timeline">
              {(visits ?? []).map((v) => {
                const p = v.properties as unknown as { code: string; title: string } | null;
                return (
                  <li key={v.id as string}>
                    <strong>{formatDate(v.starts_at as string, true)}</strong> · {v.status === "solicitada" ? "por confirmar" : "confirmada"}
                    <div className="small">{p ? `${p.code} · ${p.title}` : "Reunión"}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="stack">
          <h2>Solicitudes sin atender</h2>
          {(oldest ?? []).length === 0 ? <p className="muted">Todo atendido.</p> : (
            <ul className="timeline">
              {(oldest ?? []).map((r) => (
                <li key={r.id as string}>
                  <Link href={`/admin/solicitudes/${r.id}`}><strong>{r.number as string}</strong></Link> · {labelOf(REQUEST_KINDS, r.kind as string)}
                  <div className="small">{r.contact_name as string} · {formatDate(r.created_at as string, true)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
