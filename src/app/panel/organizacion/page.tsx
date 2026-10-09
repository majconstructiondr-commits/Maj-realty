import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { requireUser } from "@/lib/auth";
import { OPERATIONS, PROPERTY_TYPES, type ListingStatus } from "@/lib/catalog/definitions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { StateBadge, StatusBadge } from "@/components/listing-editor/StatusBadge";
import { AddMemberForm, MemberEditor, OrgDetailsForm, type MemberRow } from "./forms";

export const metadata: Metadata = { title: "Mi agencia", robots: { index: false, follow: false } };

type Org = { id: string; name: string; legal_name: string | null; rnc: string | null; phone: string | null; email: string | null; status: "pendiente" | "activa" | "suspendida"; created_at: string };
type Listing = { id: string; code: string; title: string; status: ListingStatus; operation: keyof typeof OPERATIONS; property_type: keyof typeof PROPERTY_TYPES; owner_user_id: string; updated_at: string };

const ORG_STATUS: Record<Org["status"], string> = {
  pendiente: "Pendiente de aprobación por MAJ",
  activa: "Activa",
  suspendida: "Suspendida",
};

export default async function OrganizationPage(props: PageProps<"/panel/organizacion">) {
  const sp = await props.searchParams;
  await requireUser("/panel/organizacion");
  const ctx = (await getSellerContext())!;
  if (!ctx.memberships.length) {
    return (
      <div className="section-sm">
        <h1>Mi agencia</h1>
        <p className="alert alert-info">
          No pertenece a ninguna agencia en MAJ. Para registrar la suya, envíe una solicitud como agencia en <Link href="/panel/publicar">Quiero publicar</Link>.
          Si trabaja en una agencia registrada, pida a su gestor que le añada con el correo de su cuenta.
        </p>
      </div>
    );
  }
  const membership = ctx.memberships.find((m) => m.organization_id === sp.org) ?? ctx.memberships[0];
  const orgId = membership.organization_id;
  const canManage = memberCan(membership, "manage_members");
  const canViewAll = memberCan(membership, "view_all");
  const supabase = await createClient();

  let listQ = supabase
    .from("properties")
    .select("id, code, title, status, operation, property_type, owner_user_id, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!canViewAll) listQ = listQ.eq("owner_user_id", ctx.user.id);
  const [{ data: orgData }, { data: memberData }, { data: licData }, { data: listData }] = await Promise.all([
    supabase.from("organizations").select("id, name, legal_name, rnc, phone, email, status, created_at").eq("id", orgId).maybeSingle(),
    supabase.rpc("org_member_directory", { p_org: orgId }),
    supabase.from("licenses").select("code, status, ends_at, max_members, active_listing_quota").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5),
    listQ,
  ]);
  const org = orgData as Org | null;
  if (!org) {
    return <p className="alert alert-error">No se pudo cargar la agencia.</p>;
  }
  const members = (memberData ?? []) as MemberRow[];
  const licenses = (licData ?? []) as { code: string; status: string; ends_at: string | null; max_members: number; active_listing_quota: number }[];
  const active = licenses.find((l) => l.status === "activa");
  const maxMembers = active?.max_members ?? 1;
  const listings = (listData ?? []) as Listing[];
  const names = new Map(members.map((m) => [m.user_id, m.full_name || m.email || "Miembro"]));
  const addDisabled =
    org.status !== "activa"
      ? "Podrá añadir miembros cuando MAJ active la agencia."
      : members.length >= maxMembers
        ? `La licencia de la agencia permite ${maxMembers} miembro(s). Para añadir más, solicite un plan con más miembros.`
        : null;

  return (
    <div className="section-sm">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{org.name}</h1>
        <StateBadge value={org.status} />
      </div>
      <p className="small muted">{ORG_STATUS[org.status]} · Su rol: {membership.member_role === "gestor" ? "Gestor" : "Agente"}</p>

      {ctx.memberships.length > 1 ? (
        <nav aria-label="Cambiar de agencia" className="row" style={{ marginBottom: 12 }}>
          {ctx.memberships.map((m) => (
            <Link key={m.organization_id} className="tab" href={`/panel/organizacion?org=${m.organization_id}`} aria-current={m.organization_id === orgId ? "true" : undefined}>
              {m.organization?.name ?? "Agencia"}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-labelledby="org-lic" className="card card-body" style={{ marginTop: 10 }}>
        <h2 id="org-lic" style={{ fontSize: "1.15rem", marginTop: 0 }}>Licencia de la agencia</h2>
        {active ? (
          <p style={{ margin: 0 }}>
            {active.code} · vence el {formatDate(active.ends_at)} · hasta {active.max_members} miembro(s) y {active.active_listing_quota} publicaciones activas. <Link href="/panel/licencia">Ver detalle</Link>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            Sin licencia activa{licenses[0] ? ` (última: ${licenses[0].code}, ${licenses[0].status})` : ""}. Las publicaciones de la agencia no pueden enviarse a revisión. <Link href="/panel/licencia">Ver licencia</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="org-data" style={{ marginTop: 22 }}>
        <h2 id="org-data" style={{ fontSize: "1.25rem" }}>Datos de la agencia</h2>
        {canManage ? (
          <div className="card card-body"><OrgDetailsForm org={org} /></div>
        ) : (
          <div className="facts">
            <div className="box"><span className="box-label">Nombre</span><span className="box-value">{org.name}</span></div>
            <div className="box"><span className="box-label">Razón social</span><span className={`box-value${org.legal_name ? "" : " unknown"}`}>{org.legal_name ?? "Sin indicar"}</span></div>
            <div className="box"><span className="box-label">Teléfono</span><span className={`box-value${org.phone ? "" : " unknown"}`}>{org.phone ?? "Sin indicar"}</span></div>
            <div className="box"><span className="box-label">Correo</span><span className={`box-value${org.email ? "" : " unknown"}`}>{org.email ?? "Sin indicar"}</span></div>
          </div>
        )}
      </section>

      <section aria-labelledby="org-members" style={{ marginTop: 22 }}>
        <h2 id="org-members" style={{ fontSize: "1.25rem" }}>Miembros ({members.length}{active ? ` de ${maxMembers}` : ""})</h2>
        {!canManage ? <p className="small muted">Solo los gestores ven la lista completa de miembros. Estos son sus permisos:</p> : null}
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Miembros de la agencia y permisos</caption>
            <thead>
              <tr><th scope="col">Persona</th><th scope="col">Rol</th><th scope="col">Permisos</th>{canManage ? <th scope="col"><span className="sr-only">Acciones</span></th> : null}</tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const g = m.member_role === "gestor";
                const perms = [
                  (m.can_publish) && "Publicar",
                  (g || m.can_view_all_listings) && "Ver todas las publicaciones",
                  (g || m.can_manage_members) && "Gestionar miembros",
                  (g || m.can_view_leads) && "Ver interesados",
                ].filter(Boolean);
                return (
                  <tr key={m.user_id}>
                    <td>
                      {m.full_name || "Sin nombre"}{m.user_id === ctx.user.id ? " (usted)" : ""}
                      {m.email ? <span className="xs muted" style={{ display: "block" }}>{m.email}</span> : null}
                      <span className="xs muted" style={{ display: "block" }}>Desde {formatDate(m.created_at)}</span>
                    </td>
                    <td className="small">{g ? "Gestor" : "Agente"}</td>
                    <td className="small">{perms.length ? perms.join(" · ") : "Sin permisos"}</td>
                    {canManage ? (
                      <td><MemberEditor orgId={orgId} m={m} isSelf={m.user_id === ctx.user.id} /></td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManage ? (
          <div className="card card-body" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Añadir miembro</h3>
            <AddMemberForm orgId={orgId} disabledReason={addDisabled} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="org-portfolio" style={{ marginTop: 22 }}>
        <h2 id="org-portfolio" style={{ fontSize: "1.25rem" }}>{canViewAll ? "Cartera de la agencia" : "Mis publicaciones en la agencia"}</h2>
        {listings.length ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Publicaciones de la agencia</caption>
              <thead>
                <tr><th scope="col">Publicación</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col">Actualizada</th></tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/panel/publicaciones/${l.id}/editar${canManage || l.owner_user_id === ctx.user.id ? "" : "?paso=8"}`}>{l.title}</Link>
                      <span className="xs muted" style={{ display: "block" }}>{l.code} · {PROPERTY_TYPES[l.property_type]} · {OPERATIONS[l.operation]}</span>
                    </td>
                    <td className="small">{l.owner_user_id === ctx.user.id ? "Usted" : names.get(l.owner_user_id) ?? "Otro miembro"}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="small">{formatDate(l.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card empty">No hay publicaciones de la agencia{canViewAll ? "" : " a su nombre"}.</p>
        )}
        {memberCan(membership, "publish") ? (
          <p style={{ marginTop: 10 }}><Link className="btn btn-primary btn-sm" href="/panel/publicaciones/nueva">+ Nueva publicación de la agencia</Link></p>
        ) : null}
      </section>
    </div>
  );
}
