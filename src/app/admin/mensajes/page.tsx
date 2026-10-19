import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { CONVERSATION_STATUSES } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/mensajes";
type Conv = {
  id: string; subject: string; status: string; last_message_at: string; property_id: string | null; request_id: string | null;
  properties: { code: string } | null; service_requests: { number: string } | null; conversation_participants: { user_id: string }[];
};

export default async function AdminConversations(props: PageProps<"/admin/mensajes">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.convs;
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
      <PageHeader title={t.title} />
      <p className="small muted">{t.note}</p>
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="m-q">{t.subject}</label><input id="m-q" name="q" className="input" defaultValue={str(sp, "q")} /></div>
        <div className="field"><label htmlFor="m-s">{c.status}</label><select id="m-s" name="status" className="select" defaultValue={status}><Options map={i.status.conversations} empty={c.all} /></select></div>
        <label className="check"><input type="checkbox" name="reportadas" value="1" defaultChecked={reportadas} /> {t.withReports}</label>
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>
      {error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t.subject}</th><th>{t.related}</th><th>{t.participants}</th><th>{c.status}</th><th>{t.lastMessage}</th></tr></thead>
            <tbody>
              {rows.map((cv) => (
                <tr key={cv.id}>
                  <td><Link href={`${BASE}/${cv.id}`}><strong>{cv.subject}</strong></Link></td>
                  <td className="small">
                    {cv.properties && <Link href={`/admin/inmuebles/${cv.property_id}`}>{cv.properties.code}</Link>}
                    {cv.service_requests && <Link href={`/admin/solicitudes/${cv.request_id}`}>{cv.service_requests.number}</Link>}
                  </td>
                  <td className="small">{cv.conversation_participants.length}</td>
                  <td><Badge value={cv.status} map={i.status.conversations} /></td>
                  <td className="small">{formatDate(cv.last_message_at, true)}</td>
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
