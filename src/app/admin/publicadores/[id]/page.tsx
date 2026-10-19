import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import { IdentityReview } from "@/components/admin/IdentityReview";
import { labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { approveApplication, rejectApplication, requestDocuments } from "../actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export default async function PublisherApplication(props: PageProps<"/admin/publicadores/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase, isAdmin } = await staffCtx(`/admin/publicadores/${id}`);
  const i = (await getI18n()).d;
  const S = i.status;
  const t = i.admin.publishers;
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
      <PageHeader title={fmt(t.requestOf, { who: labelFor(people, uid) })} back={{ href: "/admin/publicadores", label: t.title }}>
        <Badge value={a.status as string} map={S.application} />
      </PageHeader>
      <p className="small muted">
        {labelOf(S.applicantTypes, a.applicant_type as string)} · {fmt(t.meta, { received: formatDate(a.created_at as string, true), v: a.terms_version as string, accepted: formatDate(a.terms_accepted_at as string, true) })}
        {a.reviewed_at && <> · {fmt(t.reviewedBy, { who: labelFor(people, a.reviewed_by as string), date: formatDate(a.reviewed_at as string, true) })}</>}
      </p>
      {a.review_reason && <p className="alert alert-info small">{t.lastComment} {a.review_reason as string}</p>}

      <div className="grid-2">
        <section className="card card-body stack">
          <h2>{t.applicant}</h2>
          <DetailBoxes data={{
            [t.name]: p?.full_name, [t.email]: people.get(uid)?.email, [t.phone]: priv.data?.phone, WhatsApp: priv.data?.whatsapp,
            [t.document]: priv.data?.id_document_type ? `${priv.data.id_document_type} ${priv.data.id_document_number ?? ""}` : null,
            [t.address]: priv.data?.address, [t.accountCreated]: p ? formatDate(p.created_at) : null,
            [t.roles]: ((roles.data ?? []) as { role: string }[]).map((r) => labelOf(S.roles, r.role)).join(", "),
            [t.suspended]: p?.is_suspended, [t.requestedPlan]: (a.plans as { name: string } | null)?.name, [t.notes]: a.notes,
          }} />
          <Link href={`/admin/usuarios/${uid}`} className="small">{t.viewFullUser}</Link>
          {(others.data ?? []).length > 0 && <p className="xs muted">{t.otherRequests} {((others.data ?? []) as { id: string; status: string }[]).map((o) => <Link key={o.id} href={`/admin/publicadores/${o.id}`} style={{ marginRight: 6 }}>{labelOf(S.application, o.status)}</Link>)}</p>}
          <h3>{t.identity}</h3>
          <IdentityReview userId={uid} reviewedAt={p?.identity_reviewed_at ?? null} scope={p?.identity_review_scope ?? null} back={`/admin/publicadores/${id}`} />
          <h3>{t.profileDocs}</h3>
          {(files.data ?? []).filter((f) => f.id).length === 0 ? <p className="muted small">{t.noProfileDocs}</p> : (
            <ul>{(files.data ?? []).filter((f) => f.id).map((f) => <li key={f.name}><FileLink path={`profiles/${uid}/${f.name}`}>{f.name}</FileLink></li>)}</ul>
          )}
        </section>
        <section className="card card-body stack">
          {org && (
            <>
              <h2>{t.organization}</h2>
              <DetailBoxes data={{ [t.name]: org.name, [t.legalName]: org.legal_name, RNC: org.rnc, [t.phone]: org.phone, [t.email]: org.email, [t.status]: labelOf(S.org, org.status as string) }} />
            </>
          )}
          <h2>{t.decision}</h2>
          {!open ? <p className="small muted">{t.resolved}</p> : (
            <>
              {isAdmin ? (
                <ActionForm action={approveApplication} submit={t.approve} confirm={fmt(org ? t.approveConfirmOrg : t.approveConfirm, { role: labelOf(S.roles, a.applicant_type as string) })}>
                  <input type="hidden" name="id" value={id} />
                  <div className="field"><label htmlFor="ap-n">{t.commentOptional}</label><input id="ap-n" name="note" className="input" maxLength={2000} /></div>
                </ActionForm>
              ) : <p className="alert alert-warning small">{t.onlyAdmin}</p>}
              <ActionForm action={requestDocuments} submit={t.requestDocs} buttonClass="btn btn-outline">
                <input type="hidden" name="id" value={id} />
                <div className="field"><label htmlFor="rd" className="required">{t.docsRequired}</label><textarea id="rd" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
              </ActionForm>
              <ActionForm action={rejectApplication} submit={t.reject} buttonClass="btn btn-danger">
                <input type="hidden" name="id" value={id} />
                <div className="field"><label htmlFor="rj" className="required">{t.rejectReason}</label><textarea id="rj" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
              </ActionForm>
            </>
          )}
          <p className="xs muted">{t.afterApprove}</p>
        </section>
      </div>
    </>
  );
}
