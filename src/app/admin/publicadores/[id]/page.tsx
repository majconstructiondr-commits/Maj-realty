import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import { IdentityReview } from "@/components/admin/IdentityReview";
import { APPLICANT_TYPES, APPLICATION_STATUSES, ROLES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { approveApplication, rejectApplication, requestDocuments } from "../actions";

export default async function PublisherApplication(props: PageProps<"/admin/publicadores/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase, isAdmin } = await staffCtx(`/admin/publicadores/${id}`);
  const { data: a } = await supabase.from("publisher_applications").select("*, organizations(*), plans(name, code)").eq("id", id).maybeSingle();
  if (!a) notFound();
  const uid = a.user_id as string;
  const [profile, priv, roles, files, others] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, identity_reviewed_at, identity_review_scope, is_suspended, created_at, terms_version_accepted").eq("id", uid).maybeSingle(),
    supabase.from("profile_private").select("phone, whatsapp, id_document_type, id_document_number, address").eq("user_id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.storage.from("private-docs").list(`profiles/${uid}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
    supabase.from("publisher_applications").select("id, status, created_at").eq("user_id", uid).neq("id", id),
  ]);
  const people = await userLabels(supabase, [uid, a.reviewed_by as string | null]);
  const org = a.organizations as Record<string, unknown> | null;
  const p = profile.data as { full_name: string; display_name: string | null; identity_reviewed_at: string | null; identity_review_scope: string | null; is_suspended: boolean; created_at: string; terms_version_accepted: string | null } | null;
  const open = ["pendiente", "documentos_requeridos"].includes(a.status as string);

  return (
    <>
      <PageHeader title={`Solicitud de ${labelFor(people, uid)}`} back={{ href: "/admin/publicadores", label: "Solicitudes de publicador" }}>
        <Badge value={a.status as string} map={APPLICATION_STATUSES} />
      </PageHeader>
      <p className="small muted">
        {labelOf(APPLICANT_TYPES, a.applicant_type as string)} · recibida {formatDate(a.created_at as string, true)} · condiciones v. {a.terms_version as string} aceptadas {formatDate(a.terms_accepted_at as string, true)}
        {a.reviewed_at && <> · revisada por {labelFor(people, a.reviewed_by as string)} el {formatDate(a.reviewed_at as string, true)}</>}
      </p>
      {a.review_reason && <p className="alert alert-info small">Último comentario de revisión: {a.review_reason as string}</p>}

      <div className="grid-2">
        <section className="card card-body stack">
          <h2>Solicitante</h2>
          <DetailBoxes data={{
            Nombre: p?.full_name, Correo: people.get(uid)?.email, Teléfono: priv.data?.phone, WhatsApp: priv.data?.whatsapp,
            Documento: priv.data?.id_document_type ? `${priv.data.id_document_type} ${priv.data.id_document_number ?? ""}` : null,
            Dirección: priv.data?.address, "Cuenta creada": p ? formatDate(p.created_at) : null,
            Roles: ((roles.data ?? []) as { role: string }[]).map((r) => labelOf(ROLES, r.role)).join(", "),
            Suspendido: p?.is_suspended, "Plan solicitado": (a.plans as { name: string } | null)?.name, Notas: a.notes,
          }} />
          <Link href={`/admin/usuarios/${uid}`} className="small">Ver usuario completo</Link>
          {(others.data ?? []).length > 0 && <p className="xs muted">Otras solicitudes: {((others.data ?? []) as { id: string; status: string }[]).map((o) => <Link key={o.id} href={`/admin/publicadores/${o.id}`} style={{ marginRight: 6 }}>{labelOf(APPLICATION_STATUSES, o.status)}</Link>)}</p>}
          <h3>Identidad</h3>
          <IdentityReview userId={uid} reviewedAt={p?.identity_reviewed_at ?? null} scope={p?.identity_review_scope ?? null} back={`/admin/publicadores/${id}`} />
          <h3>Documentos del perfil</h3>
          {(files.data ?? []).filter((f) => f.id).length === 0 ? <p className="muted small">Sin documentos en el perfil.</p> : (
            <ul>{(files.data ?? []).filter((f) => f.id).map((f) => <li key={f.name}><FileLink path={`profiles/${uid}/${f.name}`}>{f.name}</FileLink></li>)}</ul>
          )}
        </section>
        <section className="card card-body stack">
          {org && (
            <>
              <h2>Organización</h2>
              <DetailBoxes data={{ Nombre: org.name, "Razón social": org.legal_name, RNC: org.rnc, Teléfono: org.phone, Correo: org.email, Estado: org.status }} />
            </>
          )}
          <h2>Decisión</h2>
          {!open ? <p className="small muted">Solicitud resuelta.</p> : (
            <>
              {isAdmin ? (
                <ActionForm action={approveApplication} submit="Aprobar y otorgar rol" confirm={`Se otorgará el rol “${labelOf(ROLES, a.applicant_type as string)}”${org ? " y se activará la organización" : ""}. ¿Continuar?`}>
                  <input type="hidden" name="id" value={id} />
                  <div className="field"><label htmlFor="ap-n">Comentario (opcional)</label><input id="ap-n" name="note" className="input" maxLength={2000} /></div>
                </ActionForm>
              ) : <p className="alert alert-warning small">La aprobación otorga un rol: solo un administrador puede aprobar. Puede solicitar documentos o rechazar.</p>}
              <ActionForm action={requestDocuments} submit="Solicitar documentos" buttonClass="btn btn-outline">
                <input type="hidden" name="id" value={id} />
                <div className="field"><label htmlFor="rd" className="required">Documentos o datos requeridos</label><textarea id="rd" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
              </ActionForm>
              <ActionForm action={rejectApplication} submit="Rechazar" buttonClass="btn btn-danger">
                <input type="hidden" name="id" value={id} />
                <div className="field"><label htmlFor="rj" className="required">Motivo del rechazo</label><textarea id="rj" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
              </ActionForm>
            </>
          )}
          <p className="xs muted">Después de aprobar, cree o active una licencia en Licencias y pagos para que pueda publicar.</p>
        </section>
      </div>
    </>
  );
}
