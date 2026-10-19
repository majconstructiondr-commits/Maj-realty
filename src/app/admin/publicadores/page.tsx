import Link from "next/link";
import { Badge, Empty, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { APPLICANT_TYPES, APPLICATION_STATUSES, labelOf } from "@/lib/admin/labels";
import { oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/publicadores";
type App = { id: string; user_id: string; applicant_type: string; status: string; created_at: string; organizations: { name: string } | null; plans: { name: string } | null };

export default async function AdminPublisherApplications(props: PageProps<"/admin/publicadores">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.publishers;
  const status = oneOf(sp, "status", Object.keys(APPLICATION_STATUSES));
  const type = oneOf(sp, "tipo", Object.keys(APPLICANT_TYPES));
  const { page, pageSize, from, to } = pageOf(sp);
  let q = supabase.from("publisher_applications").select("id, user_id, applicant_type, status, created_at, organizations(name), plans(name)", { count: "exact" });
  if (status) q = q.eq("status", status);
  else if (str(sp, "todas") !== "1") q = q.in("status", ["pendiente", "documentos_requeridos"]);
  if (type) q = q.eq("applicant_type", type);
  const { data, count, error } = await q.order("created_at", { ascending: true }).range(from, to);
  const rows = (data ?? []) as unknown as App[];
  const people = await userLabels(supabase, rows.map((r) => r.user_id));
  return (
    <>
      <PageHeader title={t.title} />
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }}>
        <div className="field"><label htmlFor="p-s">{c.status}</label><select id="p-s" name="status" className="select" defaultValue={status}><Options map={i.status.application} empty={t.pendingPlural} /></select></div>
        <div className="field"><label htmlFor="p-t">{c.kind}</label><select id="p-t" name="tipo" className="select" defaultValue={type}><Options map={i.status.applicantTypes} empty={c.all} /></select></div>
        <label className="check"><input type="checkbox" name="todas" value="1" defaultChecked={str(sp, "todas") === "1"} /> {t.includeResolved}</label>
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>
      {error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t.applicant}</th><th>{c.kind}</th><th>{t.organization}</th><th>{t.requestedPlan}</th><th>{c.status}</th><th>{t.received}</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`${BASE}/${r.id}`}><strong>{labelFor(people, r.user_id)}</strong></Link><div className="xs muted">{people.get(r.user_id)?.email}</div></td>
                <td className="small">{labelOf(i.status.applicantTypes, r.applicant_type)}</td>
                <td className="small">{r.organizations?.name ?? "—"}</td>
                <td className="small">{r.plans?.name ?? "—"}</td>
                <td><Badge value={r.status} map={i.status.application} /></td>
                <td className="small">{formatDate(r.created_at, true)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
