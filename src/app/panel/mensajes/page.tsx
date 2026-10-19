import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { isUnread } from "@/lib/panel/conversations";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.messages.meta };
}

type Conv = { id: string; subject: string; status: string; last_message_at: string; property_id: string | null; request_id: string | null };

export default async function Page() {
  const u = await requireUser("/panel/mensajes");
  const { d } = await getI18n();
  const t = d.panel.messages;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("last_read_at, participant_role, conversations(id, subject, status, last_message_at, property_id, request_id)")
    .eq("user_id", u.id)
    .limit(200);
  const rows = (data ?? [])
    .map((r) => ({ lastRead: r.last_read_at as string | null, role: r.participant_role as string, conv: r.conversations as unknown as Conv | null }))
    .filter((r): r is { lastRead: string | null; role: string; conv: Conv } => Boolean(r.conv))
    .sort((a, b) => b.conv.last_message_at.localeCompare(a.conv.last_message_at));

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      <p className="small muted">{t.lead}</p>
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && rows.length === 0 ? (
        <div className="card empty">
          <p>{t.empty}</p>
          <Link className="btn btn-primary" href="/venta">{d.panel.shared.viewProperties}</Link>
        </div>
      ) : null}
      {rows.length ? (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {rows.map(({ conv, lastRead, role }) => {
            const unread = isUnread(conv.last_message_at, lastRead);
            return (
              <li key={conv.id} className="card card-body">
                <div className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/panel/mensajes/${conv.id}`} style={{ fontWeight: unread ? 800 : 600 }}>
                      {conv.subject}
                    </Link>
                    <div className="xs muted">
                      {fmt(t.lastMessage, { date: formatDate(conv.last_message_at, true) })}
                      {role === "publicador" ? t.asPublisher : ""}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {unread ? <span className="badge badge-gold">{t.unread}</span> : null}
                    {conv.status !== "abierta" ? <span className="badge">{conv.status === "cerrada" ? t.closed : t.blocked}</span> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
