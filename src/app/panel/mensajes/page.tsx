import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { isUnread } from "@/lib/panel/conversations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

type Conv = { id: string; subject: string; status: string; last_message_at: string; property_id: string | null; request_id: string | null };

export default async function Page() {
  const u = await requireUser("/panel/mensajes");
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
      <h1>Mensajes</h1>
      <p className="small muted">Chat interno de MAJ REALTY. No está conectado a WhatsApp: un mensaje solo se considera enviado cuando aparece aquí.</p>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus conversaciones.</p> : null}
      {!error && rows.length === 0 ? (
        <div className="card empty">
          <p>No tiene conversaciones. Puede iniciar una desde la ficha de un inmueble o desde una de sus solicitudes.</p>
          <Link className="btn btn-primary" href="/venta">Ver inmuebles</Link>
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
                      Último mensaje: {formatDate(conv.last_message_at, true)}
                      {role === "publicador" ? " · Como publicador" : ""}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {unread ? <span className="badge badge-gold">Sin leer</span> : null}
                    {conv.status !== "abierta" ? <span className="badge">{conv.status === "cerrada" ? "Cerrada" : "Bloqueada"}</span> : null}
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
