import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { CONVERSATION_STATUSES } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";

const BASE = "/admin/mensajes";
type Conv = {
  id: string; subject: string; status: string; last_message_at: string; property_id: string | null; request_id: string | null;
  properties: { code: string } | null; service_requests: { number: string } | null; conversation_participants: { user_id: string }[];
};

export default async function AdminConversations(props: PageProps<"/admin/mensajes">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const status = oneOf(sp, "status", Object.keys(CONVERSATION_STATUSES));
  const term = ilikeTerm(str(sp, "q"));
  const reportadas = str(sp, "reportadas") === "1";
  const { page, pageSize, from, to } = pageOf(sp);

  let ids: string[] | null = null;
  if (reportadas) {
    const { data } = await supabase.from("message_reports").select("messages(conversation_id)").eq("status", "abierto").limit(300);
    ids = [...new Set((data ?? []).map((r) => (r.messages as unknown as { conversation_id: string } | null)?.conversation_id).filter((x): x is string => Boolean(x)))];
  }
  let q = supabase.from("conversations")
    .select("id, subject, status, last_message_at, property_id, request_id, properties(code), service_requests(number), conversation_participants(user_id)", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (term) q = q.ilike("subject", `%${term}%`);
  if (ids) q = q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data, count, error } = await q.order("last_message_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as unknown as Conv[];

  return (
    <>
      <PageHeader title="Conversaciones" />
      <p className="small muted">Chat interno de la página. No está conectado a WhatsApp: abrir un enlace de WhatsApp no genera mensajes aquí.</p>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="m-q">Asunto</label><input id="m-q" name="q" className="input" defaultValue={str(sp, "q")} /></div>
        <div className="field"><label htmlFor="m-s">Estado</label><select id="m-s" name="status" className="select" defaultValue={status}><Options map={CONVERSATION_STATUSES} empty="Todos" /></select></div>
        <label className="check"><input type="checkbox" name="reportadas" value="1" defaultChecked={reportadas} /> Con reportes abiertos</label>
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>
      {error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay conversaciones.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Asunto</th><th>Relacionado</th><th>Participantes</th><th>Estado</th><th>Último mensaje</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`${BASE}/${c.id}`}><strong>{c.subject}</strong></Link></td>
                  <td className="small">
                    {c.properties && <Link href={`/admin/inmuebles/${c.property_id}`}>{c.properties.code}</Link>}
                    {c.service_requests && <Link href={`/admin/solicitudes/${c.request_id}`}>{c.service_requests.number}</Link>}
                  </td>
                  <td className="small">{c.conversation_participants.length}</td>
                  <td><Badge value={c.status} map={CONVERSATION_STATUSES} /></td>
                  <td className="small">{formatDate(c.last_message_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
