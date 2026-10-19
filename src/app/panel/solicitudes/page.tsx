import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.requests.meta };
}

export default async function Page() {
  const u = await requireUser("/panel/solicitudes");
  const { d } = await getI18n();
  const t = d.panel.requests;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("id, number, kind, status, property_ref, created_at, updated_at")
    .eq("client_user_id", u.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      <p className="small muted">{t.lead}</p>
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && !data?.length ? (
        <div className="card empty">
          <p>{t.empty}</p>
          <Link className="btn btn-primary" href="/contacto">{t.send}</Link>
        </div>
      ) : null}
      {data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.number}</th>
                <th scope="col">{t.kind}</th>
                <th scope="col">{t.status}</th>
                <th scope="col">{t.date}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/panel/solicitudes/${r.id}`}>{r.number}</Link></td>
                  <td>{label(d.status.requestKinds, r.kind)}{r.property_ref ? <div className="xs muted">{fmt(t.ref, { ref: r.property_ref })}</div> : null}</td>
                  <td><span className={statusBadge(r.status)}>{label(d.status.requestStatuses, r.status)}</span></td>
                  <td>{formatDate(r.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
