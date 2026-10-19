import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { isUnread } from "@/lib/panel/conversations";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.home.meta };
}

export default async function Page(props: PageProps<"/panel">) {
  const sp = await props.searchParams;
  const u = await requireUser("/panel");
  const { d } = await getI18n();
  const t = d.panel.home;
  const AVISOS: Record<string, string> = { "sin-permiso": t.noPermission };
  const supabase = await createClient();
  // Vincula los alquileres registrados por MAJ con el correo confirmado de este usuario (inquilinos).
  await supabase.rpc("link_my_leases");
  const nowIso = new Date().toISOString();

  const [openReq, pendingQuotes, notifications, visits, convs] = await Promise.all([
    supabase.from("service_requests").select("id", { count: "exact", head: true })
      .eq("client_user_id", u.id).not("status", "in", "(completada,cerrada,cancelada)"),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("client_user_id", u.id).eq("status", "enviada"),
    supabase.from("notifications").select("id, kind, title, body, link, created_at").eq("user_id", u.id).is("read_at", null)
      .order("created_at", { ascending: false }).limit(15),
    supabase.from("appointments").select("id, kind, starts_at, status, client_id, agent_id, property_id")
      .or(`client_id.eq.${u.id},agent_id.eq.${u.id}`).in("status", ["solicitada", "confirmada"]).gte("starts_at", nowIso)
      .order("starts_at").limit(5),
    supabase.from("conversation_participants").select("last_read_at, conversations(last_message_at)").eq("user_id", u.id),
  ]);

  const unreadConvs = (convs.data ?? []).filter((c) => {
    const conv = c.conversations as unknown as { last_message_at: string } | null;
    return isUnread(conv?.last_message_at, c.last_read_at);
  }).length;

  const propIds = [...new Set((visits.data ?? []).map((v) => v.property_id).filter(Boolean))] as string[];
  const { data: props_ } = propIds.length ? await supabase.from("catalog").select("id, code, title").in("id", propIds) : { data: [] };
  const propMap = new Map((props_ ?? []).map((p) => [p.id as string, p as { id: string; code: string; title: string }]));

  const aviso = AVISOS[String(sp.aviso ?? "")];
  const notes = notifications.data ?? [];

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      {aviso ? <p className="alert alert-warning" role="alert">{aviso}</p> : null}
      {!u.emailConfirmed ? <p className="alert alert-warning">{t.emailUnconfirmed}</p> : null}

      <div className="grid-3">
        <Link href="/panel/solicitudes" className="card stat" style={{ textDecoration: "none" }}>
          <div className="num">{openReq.count ?? 0}</div>
          <div className="small muted">{t.openRequests}</div>
        </Link>
        <Link href="/panel/cotizaciones" className="card stat" style={{ textDecoration: "none" }}>
          <div className="num">{pendingQuotes.count ?? 0}</div>
          <div className="small muted">{t.pendingQuotes}</div>
        </Link>
        <Link href="/panel/mensajes" className="card stat" style={{ textDecoration: "none" }}>
          <div className="num">{unreadConvs}</div>
          <div className="small muted">{t.unreadConvs}</div>
        </Link>
      </div>

      <section className="card card-body" aria-labelledby="notif-title">
        <div className="row-between">
          <h2 id="notif-title" style={{ margin: 0 }}>{t.notifications}</h2>
          {notes.length > 1 ? (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="btn btn-ghost btn-sm">{t.markAll}</button>
            </form>
          ) : null}
        </div>
        {notifications.error ? <p className="alert alert-error" role="alert">{t.notificationsError}</p> : null}
        {notes.length === 0 ? (
          <p className="muted small">{t.noNotifications}</p>
        ) : (
          <ul className="timeline" style={{ marginTop: 12 }}>
            {notes.map((n) => {
              const href = n.link ? safeNext(n.link, "") : "";
              return (
                <li key={n.id}>
                  <div className="row-between">
                    <div style={{ minWidth: 0 }}>
                      <strong>{href ? <Link href={href}>{n.title}</Link> : n.title}</strong>
                      {n.body ? <p className="small" style={{ margin: "2px 0" }}>{n.body}</p> : null}
                      <span className="xs muted">{formatDate(n.created_at, true)}</span>
                    </div>
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <button type="submit" className="btn btn-ghost btn-sm" aria-label={fmt(t.markReadAria, { title: n.title })}>{t.markRead}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card card-body" aria-labelledby="visits-title">
        <div className="row-between">
          <h2 id="visits-title" style={{ margin: 0 }}>{t.upcomingVisits}</h2>
          <Link href="/panel/visitas" className="small">{t.viewAll}</Link>
        </div>
        {(visits.data ?? []).length === 0 ? (
          <p className="muted small">{t.noVisits}</p>
        ) : (
          <ul className="timeline" style={{ marginTop: 12 }}>
            {(visits.data ?? []).map((v) => {
              const p = v.property_id ? propMap.get(v.property_id) : undefined;
              return (
                <li key={v.id}>
                  <strong>{formatDate(v.starts_at, true)}</strong> · {label(d.status.appointmentKinds, v.kind)}{" "}
                  <span className={statusBadge(v.status)}>{label(d.status.appointment, v.status)}</span>
                  {p ? <div className="small">{p.title} ({p.code})</div> : null}
                  {v.agent_id === u.id ? <div className="xs muted">{t.youAreAgent}</div> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
