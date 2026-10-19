import Link from "next/link";
import { Empty, Options, PageHeader, Pagination, SubNav } from "@/components/admin/Bits";
import { ROLES, labelOf } from "@/lib/admin/labels";
import { oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/usuarios";
type U = { id: string; full_name: string; display_name: string | null; email: string | null; roles: string[]; is_suspended: boolean; identity_reviewed_at: string | null; created_at: string; total_count: number };


export default async function AdminUsers(props: PageProps<"/admin/usuarios">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.users;
  const USER_TABS = [{ href: "/admin/usuarios", label: t.tabUsers }, { href: "/admin/usuarios/agencias", label: t.tabOrgs }];
  const role = oneOf(sp, "rol", Object.keys(ROLES));
  const susp = str(sp, "suspendidos");
  const { page, pageSize, from } = pageOf(sp);
  const { data, error } = await supabase.rpc("staff_user_directory", {
    p_search: str(sp, "q", 160) || null, p_role: role || null, p_suspended: susp === "1" ? true : susp === "0" ? false : null,
    p_limit: pageSize, p_offset: from,
  });
  const rows = (data ?? []) as U[];
  const total = Number(rows[0]?.total_count ?? 0);
  return (
    <>
      <PageHeader title={t.title} />
      <SubNav items={USER_TABS} current={BASE} />
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="u-q">{c.search}</label><input id="u-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder={t.searchPlaceholder} /></div>
        <div className="field"><label htmlFor="u-r">{t.role}</label><select id="u-r" name="rol" className="select" defaultValue={role}><Options map={i.status.roles} empty={c.all} /></select></div>
        <div className="field"><label htmlFor="u-s">{t.suspension}</label><select id="u-s" name="suspendidos" className="select" defaultValue={susp}><option value="">{c.all}</option><option value="1">{t.suspendedPlural}</option><option value="0">{t.activePlural}</option></select></div>
        <div className="row"><button className="btn btn-primary" type="submit">{c.search}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>
      {error && <p className="alert alert-error">{t.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.empty}</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>{t.name}</th><th>{t.email}</th><th>{t.roles}</th><th>{t.identity}</th><th>{t.joined}</th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`${BASE}/${u.id}`}><strong>{u.full_name || u.display_name || t.noName}</strong></Link>{u.is_suspended && <> <span className="badge badge-danger">{t.suspended}</span></>}</td>
                <td className="small">{u.email}</td>
                <td className="small">{u.roles.map((r) => labelOf(i.status.roles, r)).join(", ")}</td>
                <td className="small">{u.identity_reviewed_at ? <span className="badge badge-success">{t.reviewedF}</span> : "—"}</td>
                <td className="small">{formatDate(u.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={total} pageSize={pageSize} />
    </>
  );
}
