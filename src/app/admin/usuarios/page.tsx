import Link from "next/link";
import { Empty, Options, PageHeader, Pagination, SubNav } from "@/components/admin/Bits";
import { ROLES, labelOf } from "@/lib/admin/labels";
import { oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { staffCtx } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";

const BASE = "/admin/usuarios";
type U = { id: string; full_name: string; display_name: string | null; email: string | null; roles: string[]; is_suspended: boolean; identity_reviewed_at: string | null; created_at: string; total_count: number };

const USER_TABS = [{ href: "/admin/usuarios", label: "Usuarios" }, { href: "/admin/usuarios/agencias", label: "Agencias y organizaciones" }];

export default async function AdminUsers(props: PageProps<"/admin/usuarios">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
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
      <PageHeader title="Usuarios y agencias" />
      <SubNav items={USER_TABS} current={BASE} />
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="u-q">Buscar</label><input id="u-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder="Nombre o correo" /></div>
        <div className="field"><label htmlFor="u-r">Rol</label><select id="u-r" name="rol" className="select" defaultValue={role}><Options map={ROLES} empty="Todos" /></select></div>
        <div className="field"><label htmlFor="u-s">Suspensión</label><select id="u-s" name="suspendidos" className="select" defaultValue={susp}><option value="">Todos</option><option value="1">Suspendidos</option><option value="0">Activos</option></select></div>
        <div className="row"><button className="btn btn-primary" type="submit">Buscar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>
      {error && <p className="alert alert-error">No se pudo cargar el directorio.</p>}
      {rows.length === 0 ? <Empty>No hay usuarios con esos filtros.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Roles</th><th>Identidad</th><th>Alta</th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`${BASE}/${u.id}`}><strong>{u.full_name || u.display_name || "Sin nombre"}</strong></Link>{u.is_suspended && <> <span className="badge badge-danger">Suspendido</span></>}</td>
                <td className="small">{u.email}</td>
                <td className="small">{u.roles.map((r) => labelOf(ROLES, r)).join(", ")}</td>
                <td className="small">{u.identity_reviewed_at ? <span className="badge badge-success">Revisada</span> : "—"}</td>
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
