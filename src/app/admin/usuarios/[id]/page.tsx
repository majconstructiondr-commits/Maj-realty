import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, PageHeader } from "@/components/admin/Bits";
import { IdentityReview } from "@/components/admin/IdentityReview";
import { APPLICATION_STATUSES, LICENSE_STATUSES, REQUEST_KINDS, ROLES, STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { grantRole, revokeRole, setSuspended } from "../actions";

export default async function AdminUser(props: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase, isAdmin, user } = await staffCtx(`/admin/usuarios/${id}`);
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [priv, roles, members, props_, lic, apps, reqs] = await Promise.all([
    supabase.from("profile_private").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("user_roles").select("role, granted_by, granted_at").eq("user_id", id),
    supabase.from("organization_members").select("member_role, organizations(id, name, status)").eq("user_id", id),
    supabase.from("properties").select("id, code, title, status").eq("owner_user_id", id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("licenses").select("id, code, status, ends_at").eq("holder_user_id", id).order("created_at", { ascending: false }),
    supabase.from("publisher_applications").select("id, status, applicant_type, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("service_requests").select("id, number, kind, status, created_at").eq("client_user_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const roleRows = (roles.data ?? []) as { role: string; granted_by: string | null; granted_at: string }[];
  const people = await userLabels(supabase, [id, ...roleRows.map((r) => r.granted_by)]);
  const has = new Set(roleRows.map((r) => r.role));
  const pr = priv.data as Record<string, unknown> | null;

  return (
    <>
      <PageHeader title={(p.full_name as string) || "Usuario"} back={{ href: "/admin/usuarios", label: "Usuarios" }}>
        {p.is_suspended && <span className="badge badge-danger">Suspendido</span>}
      </PageHeader>
      <div className="grid-2">
        <section className="card card-body stack">
          <h2>Perfil</h2>
          <DetailBoxes data={{
            Correo: people.get(id)?.email, "Nombre visible": p.display_name, Teléfono: pr?.phone, WhatsApp: pr?.whatsapp,
            Documento: pr?.id_document_type ? `${pr.id_document_type} ${pr.id_document_number ?? ""}` : null, Dirección: pr?.address,
            "Acepta comunicaciones": pr?.marketing_opt_in, "Términos aceptados": p.terms_version_accepted ? `${p.terms_version_accepted} · ${formatDate(p.terms_accepted_at as string)}` : null,
            Alta: formatDate(p.created_at as string),
          }} />
          <h3>Identidad</h3>
          <IdentityReview userId={id} reviewedAt={p.identity_reviewed_at as string | null} scope={p.identity_review_scope as string | null} back={`/admin/usuarios/${id}`} />
          <h3>Suspensión</h3>
          {id === user.id ? <p className="small muted">No puede suspender su propia cuenta.</p> : (
            <ActionForm action={setSuspended} submit={p.is_suspended ? "Retirar suspensión" : "Suspender cuenta"} buttonClass={p.is_suspended ? "btn btn-ghost btn-sm" : "btn btn-danger btn-sm"}
              confirm={p.is_suspended ? "¿Reactivar la cuenta?" : "La cuenta perderá el efecto de sus roles (publicar, panel, etc.). ¿Suspender?"}>
              <input type="hidden" name="user_id" value={id} /><input type="hidden" name="suspended" value={p.is_suspended ? "false" : "true"} />
            </ActionForm>
          )}
        </section>
        <section className="card card-body stack">
          <h2>Roles</h2>
          <ul>{roleRows.map((r) => (
            <li key={r.role} className="row">
              <strong>{labelOf(ROLES, r.role)}</strong> <span className="xs muted">desde {formatDate(r.granted_at)}{r.granted_by ? ` · ${labelFor(people, r.granted_by)}` : ""}</span>
              {isAdmin && r.role !== "cliente" && (
                <ActionForm action={revokeRole} submit="Retirar" buttonClass="btn btn-ghost btn-sm" inline confirm={`¿Retirar el rol ${labelOf(ROLES, r.role)}?`}>
                  <input type="hidden" name="user_id" value={id} /><input type="hidden" name="role" value={r.role} />
                </ActionForm>
              )}
            </li>
          ))}</ul>
          {isAdmin ? (
            <ActionForm action={grantRole} submit="Otorgar rol" buttonClass="btn btn-primary btn-sm" inline confirm="¿Otorgar este rol? Los roles de personal y administrador dan acceso a datos privados.">
              <input type="hidden" name="user_id" value={id} />
              <select name="role" className="select" aria-label="Rol" style={{ maxWidth: 220 }}>
                {Object.entries(ROLES).filter(([k]) => !has.has(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </ActionForm>
          ) : <p className="small muted">Solo los administradores otorgan o retiran roles.</p>}
          <p className="xs muted">El personal y los administradores necesitan segundo factor (MFA) para acceder al panel.</p>
          <h3>Organizaciones</h3>
          {(members.data ?? []).length === 0 ? <p className="small muted">Ninguna.</p> : (
            <ul>{((members.data ?? []) as unknown as { member_role: string; organizations: { id: string; name: string; status: string } | null }[]).map((m) => (
              <li key={m.organizations?.id}>{m.organizations?.name} · {m.member_role} · {m.organizations?.status}</li>
            ))}</ul>
          )}
        </section>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>Publicaciones</h2>
          {((props_.data ?? []) as { id: string; code: string; title: string; status: string }[]).map((x) => (
            <p key={x.id} className="small"><Link href={`/admin/inmuebles/${x.id}`}>{x.code}</Link> · {x.title} · <Badge value={x.status} map={STATUSES} /></p>
          ))}
          {(props_.data ?? []).length === 0 && <p className="small muted">Ninguna.</p>}
          <h2>Licencias</h2>
          {((lic.data ?? []) as { id: string; code: string; status: string; ends_at: string | null }[]).map((x) => (
            <p key={x.id} className="small"><Link href={`/admin/licencias/${x.id}`}>{x.code}</Link> · {labelOf(LICENSE_STATUSES, x.status)} · vence {formatDate(x.ends_at)}</p>
          ))}
          {(lic.data ?? []).length === 0 && <p className="small muted">Ninguna.</p>}
        </section>
        <section className="card card-body stack">
          <h2>Solicitudes de publicador</h2>
          {((apps.data ?? []) as { id: string; status: string; applicant_type: string; created_at: string }[]).map((x) => (
            <p key={x.id} className="small"><Link href={`/admin/publicadores/${x.id}`}>{formatDate(x.created_at)}</Link> · {x.applicant_type} · {labelOf(APPLICATION_STATUSES, x.status)}</p>
          ))}
          {(apps.data ?? []).length === 0 && <p className="small muted">Ninguna.</p>}
          <h2>Solicitudes de servicio</h2>
          {((reqs.data ?? []) as { id: string; number: string; kind: string; status: string }[]).map((x) => (
            <p key={x.id} className="small"><Link href={`/admin/solicitudes/${x.id}`}>{x.number}</Link> · {labelOf(REQUEST_KINDS, x.kind)} · {x.status}</p>
          ))}
          {(reqs.data ?? []).length === 0 && <p className="small muted">Ninguna.</p>}
        </section>
      </div>
    </>
  );
}
