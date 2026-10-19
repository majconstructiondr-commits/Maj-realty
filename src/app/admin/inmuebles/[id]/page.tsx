import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import { MobilePreview } from "@/components/admin/MobilePreview";
import { buildChangeDiff, fieldLabel, type ChangeSet, type DiffText, type PriceRow } from "@/lib/admin/diff";
import { labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { localDay } from "@/lib/admin/time";
import { NUMERIC_FIELDS, SPACE_FIELDS } from "@/lib/catalog/definitions";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import {
  approveMedia, approveProperty, clearDocumentsReviewed, markDocumentsReviewed, pauseProperty, rejectProperty,
  reviewChange, reviewDocument, saveStaffNotes, setAdvisor, setMajListing, setPropertyStatus,
} from "../actions";
import { fmt, type Dictionary } from "@/i18n";
import { getI18n } from "@/i18n/server";

type Dict = Record<string, unknown>;

const PRIVATE_HIDDEN = ["property_id", "updated_at", "staff_notes"];

/** Textos del resumen de cambios en el idioma activo. */
const diffText = (i: Dictionary): DiffText => ({
  fields: i.admin.diff.fields, numericFields: i.labels.numericFields, spaceFields: i.labels.spaceFields, features: i.labels.features,
  operations: i.labels.operations, propertyTypes: i.labels.propertyTypes, conditions: i.labels.conditions, tri: i.labels.tri,
  yes: i.admin.common.yes, no: i.admin.common.no, removed: i.admin.diff.removed, price: i.admin.diff.price, feature: i.admin.diff.feature,
});

export default async function PropertyReview(props: PageProps<"/admin/inmuebles/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/inmuebles/${id}`);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.prop;
  const text = diffText(i);

  const { data: p } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const prop = p as Dict & { code: string; slug: string; title: string; status: string; owner_user_id: string; organization_id: string | null; license_id: string | null; advisor_id: string | null; is_maj_listing: boolean };

  const [priv, prices, media, docs, reviews, changes, advisors, license, org, dups, isPublic, views, clicks, shares] = await Promise.all([
    supabase.from("property_private").select("*").eq("property_id", id).maybeSingle(),
    supabase.from("property_prices").select("*").eq("property_id", id),
    supabase.from("property_media").select("*").eq("property_id", id).order("sort_order"),
    supabase.from("property_documents").select("*").eq("property_id", id).order("created_at", { ascending: false }),
    supabase.from("property_reviews").select("*").eq("property_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("property_change_requests").select("*").eq("property_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("advisors").select("id, display_name, is_active").order("sort_order"),
    prop.license_id ? supabase.from("licenses").select("id, code, status, ends_at").eq("id", prop.license_id).maybeSingle() : Promise.resolve({ data: null }),
    prop.organization_id ? supabase.from("organizations").select("id, name, status").eq("id", prop.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("possible_duplicates", { p_property: id }),
    supabase.rpc("property_is_public", { p_property: id }),
    supabase.from("property_events").select("id", { count: "exact", head: true }).eq("property_id", id).eq("kind", "vista"),
    supabase.from("property_events").select("id", { count: "exact", head: true }).eq("property_id", id).eq("kind", "clic_whatsapp"),
    supabase.from("property_events").select("id", { count: "exact", head: true }).eq("property_id", id).eq("kind", "compartir"),
  ]);

  const privRow = (priv.data ?? null) as Dict | null;
  const priceRows = (prices.data ?? []) as (PriceRow & { amount: number | null; currency: Currency })[];
  const mediaRows = (media.data ?? []) as { id: string; kind: string; storage_path: string | null; external_url: string | null; alt_text: string; approved: boolean; is_cover: boolean }[];
  const docRows = (docs.data ?? []) as { id: string; doc_type: string; storage_path: string; file_name: string; review_status: string; review_notes: string | null; reviewed_by: string | null; reviewed_at: string | null; uploaded_by: string; created_at: string }[];
  const reviewRows = (reviews.data ?? []) as { id: number; action: string; from_status: string | null; to_status: string | null; reason: string | null; actor_id: string | null; created_at: string }[];
  const changeRows = (changes.data ?? []) as { id: string; status: string; changes: ChangeSet; requested_by: string; review_reason: string | null; reviewed_at: string | null; created_at: string }[];
  const pending = changeRows.find((c) => c.status === "pendiente");

  const auditIds = [id, ...docRows.map((d) => d.id), ...priceRows.map((x) => String(x.id)), ...changeRows.map((c) => c.id)];
  const { data: audit } = await supabase.from("audit_log").select("id, actor_id, action, table_name, created_at, new_data, old_data")
    .in("record_id", auditIds).order("created_at", { ascending: false }).limit(40);

  const people = await userLabels(supabase, [
    prop.owner_user_id, ...docRows.map((d) => d.uploaded_by), ...docRows.map((d) => d.reviewed_by), ...reviewRows.map((r) => r.actor_id),
    ...changeRows.map((c) => c.requested_by), ...((audit ?? []) as { actor_id: string | null }[]).map((a) => a.actor_id),
  ]);
  const signed = new Map<string, string>();
  const paths = mediaRows.map((m) => m.storage_path).filter((x): x is string => Boolean(x));
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("property-media").createSignedUrls(paths, 300);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const publicHref = `/inmuebles/${prop.code.toLowerCase()}${prop.slug ? `-${prop.slug}` : ""}`;
  const pendingMedia = mediaRows.filter((m) => !m.approved).length;
  const ownerLabel = people.get(prop.owner_user_id);
  const features = (prop.features ?? {}) as Record<string, { v?: string; d?: string }>;

  const L = i.labels;
  const fl = (k: string) => fieldLabel(k, text);
  const publicFacts: Dict = {
    [fl("operation")]: labelOf(L.operations, prop.operation as string),
    [fl("property_type")]: labelOf(L.propertyTypes, prop.property_type as string),
    [fl("condition")]: labelOf(L.conditions, prop.condition as string),
    [c.location]: [prop.sector, prop.municipality, prop.province].filter(Boolean).join(", "),
    [t.approxCoords]: prop.approx_lat ? `${prop.approx_lat}, ${prop.approx_lng}` : null,
    [fl("public_address")]: prop.exact_address_public ? prop.public_address : t.notPublished,
    [t.availableFrom]: prop.available_from ? formatDate(prop.available_from as string) : null,
    ...Object.fromEntries(Object.entries(NUMERIC_FIELDS).map(([k, v]) => [fl(k), (prop.na_fields as string[] | undefined)?.includes(k) ? L.tri.no_aplica : prop[k] === null ? L.tri.desconocido : `${formatNumber(prop[k] as number, 2)} ${v.unit}`.trim()])),
    ...Object.fromEntries(Object.keys(SPACE_FIELDS).map((k) => [fl(k), labelOf(L.tri, prop[k] as string)])),
    [fl("roof_use_detail")]: prop.roof_use_detail,
    [fl("condo_rules")]: prop.condo_rules,
    [fl("restrictions")]: prop.restrictions,
  };

  return (
    <>
      <PageHeader title={`${prop.code} · ${prop.title}`} back={{ href: "/admin/inmuebles", label: t.back }}>
        <Badge value={prop.status} map={i.status.listing} />
        {prop.is_maj_listing && <span className="badge badge-navy">{t.majListing}</span>}
        {prop.is_demo ? <span className="badge badge-demo">{t.demo}</span> : null}
        <Link href={`/panel/publicaciones/${id}/editar`} className="btn btn-ghost btn-sm">{t.openEditor}</Link>
        {isPublic.data === true && (<><Link href={publicHref} className="btn btn-ghost btn-sm" target="_blank">{t.viewPublic}</Link><MobilePreview href={publicHref} /></>)}
      </PageHeader>

      {(dups.data ?? []).length > 0 && (
        <div className="alert alert-warning">
          <strong>{t.dups}</strong> {t.dupsNote}{" "}
          {(dups.data as { property_id: string; code: string; title: string; status: string }[]).map((d) => (
            <Link key={d.property_id} href={`/admin/inmuebles/${d.property_id}`} style={{ marginRight: 8 }}>{d.code} ({labelOf(i.status.listing, d.status)})</Link>
          ))}
        </div>
      )}

      <section className="card card-body stack" aria-labelledby="rev">
        <h2 id="rev">{t.review}</h2>
        <p className="small muted">
          {t.submittedAt} {formatDate(prop.submitted_at as string, true) || "—"} · {t.reviewedAt} {formatDate(prop.reviewed_at as string, true) || "—"}
          {prop.rejection_reason ? <> · {t.lastRejection} {String(prop.rejection_reason)}</> : null}
          {prop.pause_reason ? <> · {t.pauseReason} {String(prop.pause_reason)}</> : null}
        </p>
        <div className="grid-3">
          {["en_revision", "pausado", "rechazado", "reservado"].includes(prop.status) && (
            <ActionForm action={approveProperty} submit={t.approvePublish} confirm={t.approveConfirm}>
              <input type="hidden" name="id" value={id} />
              <p className="small">{t.approveNote}</p>
            </ActionForm>
          )}
          {prop.status !== "rechazado" && prop.status !== "archivado" && (
            <ActionForm action={rejectProperty} submit={t.reject} buttonClass="btn btn-danger">
              <input type="hidden" name="id" value={id} />
              <div className="field"><label htmlFor="rej" className="required">{t.rejectReason}</label><textarea id="rej" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          )}
          {["publicado", "reservado", "en_revision"].includes(prop.status) && (
            <ActionForm action={pauseProperty} submit={t.pause} buttonClass="btn btn-outline">
              <input type="hidden" name="id" value={id} />
              <div className="field"><label htmlFor="pau" className="required">{t.pauseReasonField}</label><textarea id="pau" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          )}
        </div>
        <ActionForm action={setPropertyStatus} submit={t.changeStatus} buttonClass="btn btn-ghost" inline confirm={t.changeStatusConfirm}>
          <input type="hidden" name="id" value={id} />
          <label htmlFor="st" className="small">{t.closeArchive}</label>
          <select id="st" name="status" className="select" style={{ maxWidth: 200 }} defaultValue="vendido">
            <option value="reservado">{t.reserved}</option><option value="vendido">{t.soldConfirmed}</option>
            <option value="rentado">{t.rentedConfirmed}</option><option value="archivado">{t.archived}</option>
          </select>
          <input name="reason" className="input" style={{ maxWidth: 260 }} placeholder={t.noteOptional} maxLength={500} />
        </ActionForm>
      </section>

      {pending && (
        <section className="card card-body stack" style={{ marginTop: 16 }} aria-labelledby="chg">
          <h2 id="chg">{t.pendingChanges}</h2>
          <p className="small muted">{fmt(t.requestedBy, { who: labelFor(people, pending.requested_by), date: formatDate(pending.created_at, true) })}</p>
          <ChangeDiff changes={pending.changes} property={prop} priv={privRow} prices={priceRows} i={i} />
          <div className="grid-2">
            <ActionForm action={reviewChange} submit={t.approveChanges} confirm={t.approveChangesConfirm}>
              <input type="hidden" name="request_id" value={pending.id} /><input type="hidden" name="property_id" value={id} /><input type="hidden" name="decision" value="aprobar" />
              <div className="field"><label htmlFor="cr-ok">{t.commentOptional}</label><input id="cr-ok" name="reason" className="input" maxLength={2000} /></div>
            </ActionForm>
            <ActionForm action={reviewChange} submit={t.rejectChanges} buttonClass="btn btn-danger">
              <input type="hidden" name="request_id" value={pending.id} /><input type="hidden" name="property_id" value={id} /><input type="hidden" name="decision" value="rechazar" />
              <div className="field"><label htmlFor="cr-no" className="required">{t.reasonField}</label><input id="cr-no" name="reason" className="input" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>{t.ownership}</h2>
          <p className="small">
            {t.ownerLabel} <strong>{ownerLabel?.full_name || "—"}</strong> {ownerLabel?.email && <>· {ownerLabel.email}</>} <Link href={`/admin/usuarios/${prop.owner_user_id}`}>{t.viewUser}</Link><br />
            {t.orgLabel} {org.data ? `${(org.data as Dict).name} (${labelOf(i.status.org, (org.data as Dict).status as string)})` : "—"}<br />
            {t.licenseLabel} {license.data ? <Link href={`/admin/licencias/${(license.data as Dict).id}`}>{String((license.data as Dict).code)}</Link> : prop.is_maj_listing ? t.notRequired : t.unassigned}
            {license.data ? <> · {labelOf(i.status.license, (license.data as Dict).status as string)} · {fmt(t.expires, { date: formatDate((license.data as Dict).ends_at as string) })}</> : null}
          </p>
          <ActionForm action={setAdvisor} submit={t.saveAdvisor} buttonClass="btn btn-ghost btn-sm">
            <input type="hidden" name="id" value={id} />
            <div className="field">
              <label htmlFor="adv">{t.advisor}</label>
              <select id="adv" name="advisor_id" className="select" defaultValue={prop.advisor_id ?? ""}>
                <option value="">{t.noAdvisor}</option>
                {((advisors.data ?? []) as { id: string; display_name: string; is_active: boolean }[]).map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}{a.is_active ? "" : ` ${t.inactive}`}</option>
                ))}
              </select>
            </div>
          </ActionForm>
          <ActionForm action={setMajListing} submit={prop.is_maj_listing ? t.unmarkMaj : t.markMaj} buttonClass="btn btn-ghost btn-sm"
            confirm={prop.is_maj_listing ? t.unmarkMajConfirm : t.markMajConfirm}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="value" value={prop.is_maj_listing ? "false" : "true"} />
          </ActionForm>
          <h3>{t.stats}</h3>
          <p className="small">{t.views} {formatNumber(views.count ?? 0)} · {t.waClicks} {formatNumber(clicks.count ?? 0)} · {t.shares} {formatNumber(shares.count ?? 0)}</p>
          <p className="xs muted">{t.interestNote}</p>
        </section>

        <section className="card card-body stack">
          <h2>{t.prices}</h2>
          {priceRows.length === 0 ? <p className="muted">{t.noPrices}</p> : priceRows.map((x) => (
            <div key={String(x.id)} className="box">
              <span className="box-label">{x.operation === "venta" ? labelOf(i.labels.operations, "venta") : `${labelOf(i.labels.operations, "renta")} ${x.rent_period ? `(${i.labels.rentPeriods[String(x.rent_period)] ?? x.rent_period})` : ""}`}</span>
              <span className="box-value">{formatMoney(x.amount, x.currency)} {x.negotiable ? `· ${t.negotiable}` : ""}</span>
              {x.maintenance_amount != null && <span className="small">{t.maintenance} {formatMoney(x.maintenance_amount as number, x.maintenance_currency as Currency)}</span>}
            </div>
          ))}
        </section>
      </div>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{t.publicListing}</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{String(prop.description ?? "")}</p>
        <DetailBoxes data={publicFacts} />
        {Object.keys(features).length > 0 && (
          <>
            <h3>{t.features}</h3>
            <DetailBoxes data={Object.fromEntries(Object.entries(features).map(([k, v]) => [i.labels.features[k] ?? k, `${labelOf(i.labels.tri, v.v)}${v.d ? ` · ${v.d}` : ""}`]))} />
          </>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{t.privateData}</h2>
        <p className="small muted">{t.privateNote}</p>
        {privRow ? (
          <DetailBoxes data={Object.fromEntries(Object.entries(privRow).filter(([k]) => !PRIVATE_HIDDEN.includes(k)).map(([k, v]) => [fl(k), v]))} />
        ) : <p className="muted">{t.noPrivate}</p>}
        <ActionForm action={saveStaffNotes} submit={t.saveNotes} buttonClass="btn btn-ghost btn-sm">
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="sn">{t.staffNotes}</label><textarea id="sn" name="staff_notes" className="textarea" maxLength={4000} defaultValue={(privRow?.staff_notes as string) ?? ""} /></div>
        </ActionForm>
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <div className="row-between">
          <h2>{fmt(t.mediaCount, { n: mediaRows.length })}</h2>
          {pendingMedia > 0 && (
            <ActionForm action={approveMedia} submit={fmt(t.approveAllPending, { n: pendingMedia })} buttonClass="btn btn-primary btn-sm" inline>
              <input type="hidden" name="property_id" value={id} />
            </ActionForm>
          )}
        </div>
        {mediaRows.length === 0 ? <p className="muted">{t.noMedia}</p> : (
          <div className="grid-4">
            {mediaRows.map((m) => (
              <div key={m.id} className="card">
                {m.storage_path && signed.get(m.storage_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.get(m.storage_path)} alt={m.alt_text || t.imageAlt} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                ) : m.external_url ? <a href={m.external_url} target="_blank" rel="noopener noreferrer" className="card-body">{fmt(t.externalLink, { kind: m.kind })}</a> : <div className="card-body muted">{t.noPreview}</div>}
                <div className="card-body small">
                  {m.is_cover && <span className="badge badge-gold">{t.cover}</span>}{" "}
                  {m.approved ? <span className="badge badge-success">{t.approvedF}</span> : <span className="badge badge-warning">{t.pendingF}</span>}
                  {!m.approved && (
                    <ActionForm action={approveMedia} submit={t.approve} buttonClass="btn btn-ghost btn-sm">
                      <input type="hidden" name="property_id" value={id} /><input type="hidden" name="media_id" value={m.id} />
                    </ActionForm>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>{t.documents}</h2>
        <div className="alert alert-info small">
          {prop.documents_reviewed_at ? (
            <>{fmt(t.docReviewBy, { date: formatDate(prop.documents_reviewed_at as string) })} <strong>{String(prop.documents_review_scope ?? "")}</strong></>
          ) : t.noDocReview}
        </div>
        <div className="grid-2">
          <ActionForm action={markDocumentsReviewed} submit={t.registerDocReview} confirm={t.docReviewConfirm}>
            <input type="hidden" name="id" value={id} />
            <div className="field"><label htmlFor="drd" className="required">{t.reviewDate}</label><input id="drd" type="date" name="reviewed_at" className="input" defaultValue={localDay(new Date())} required /></div>
            <div className="field">
              <label htmlFor="drs" className="required">{t.reviewScope}</label>
              <input id="drs" name="scope" className="input" required minLength={10} maxLength={300} defaultValue={(prop.documents_review_scope as string) ?? ""} placeholder={t.scopePlaceholder} />
              <span className="hint">{t.scopeHint}</span>
            </div>
          </ActionForm>
          {prop.documents_reviewed_at ? (
            <ActionForm action={clearDocumentsReviewed} submit={t.clearDocReview} buttonClass="btn btn-ghost btn-sm" confirm={t.clearDocReviewConfirm}>
              <input type="hidden" name="id" value={id} />
            </ActionForm>
          ) : null}
        </div>
        {docRows.length === 0 ? <p className="muted">{t.noDocs}</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.document}</th><th>{t.uploaded}</th><th>{t.status}</th><th>{t.review}</th></tr></thead>
              <tbody>
                {docRows.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{labelOf(i.status.docTypes, d.doc_type)}</strong><div className="small"><FileLink path={d.storage_path}>{d.file_name}</FileLink></div></td>
                    <td className="small">{formatDate(d.created_at, true)}<div>{labelFor(people, d.uploaded_by)}</div></td>
                    <td><Badge value={d.review_status} map={i.status.docReview} />{d.review_notes && <div className="small">{d.review_notes}</div>}{d.reviewed_at && <div className="xs muted">{labelFor(people, d.reviewed_by)} · {formatDate(d.reviewed_at, true)}</div>}</td>
                    <td>
                      <ActionForm action={reviewDocument} submit={t.save} buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={d.id} /><input type="hidden" name="property_id" value={id} />
                        <select name="review_status" className="select" aria-label={t.result} defaultValue={d.review_status === "observado" ? "observado" : "revisado"}>
                          <option value="revisado">{t.reviewed}</option><option value="observado">{t.flagged}</option>
                        </select>
                        <input name="review_notes" className="input" aria-label={t.notes} placeholder={t.notesPlaceholder} maxLength={2000} defaultValue={d.review_notes ?? ""} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>{t.history}</h2>
          {reviewRows.length === 0 ? <p className="muted">{t.noHistory}</p> : (
            <ul className="timeline">
              {reviewRows.map((r) => (
                <li key={r.id}>
                  <strong>{r.action.replace(/_/g, " ")}</strong>{r.from_status || r.to_status ? `: ${labelOf(i.status.listing, r.from_status)} → ${labelOf(i.status.listing, r.to_status)}` : ""}
                  {r.reason && <div className="small">{t.reasonLabel} {r.reason}</div>}
                  <div className="xs muted">{formatDate(r.created_at, true)} · {labelFor(people, r.actor_id, t.system)}</div>
                </li>
              ))}
            </ul>
          )}
          {changeRows.filter((c) => c.status !== "pendiente").length > 0 && (
            <>
              <h3>{t.previousChanges}</h3>
              <ul className="timeline">
                {changeRows.filter((c) => c.status !== "pendiente").map((c) => (
                  <li key={c.id}>
                    <Badge value={c.status} map={i.status.payment} /> {formatDate(c.created_at, true)} · {labelFor(people, c.requested_by)}
                    {c.review_reason && <div className="small">{c.review_reason}</div>}
                    <details><summary className="small">{t.viewChanges}</summary><ChangeDiff changes={c.changes} property={prop} priv={privRow} prices={priceRows} i={i} /></details>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="card card-body stack">
          <h2>{t.audit}</h2>
          {(audit ?? []).length === 0 ? <p className="muted">{t.noEntries}</p> : (
            <ul className="timeline">
              {((audit ?? []) as { id: number; actor_id: string | null; action: string; table_name: string; created_at: string; new_data: Dict | null; old_data: Dict | null }[]).map((a) => (
                <li key={a.id}>
                  <strong>{a.action}</strong> · {a.table_name}
                  <div className="xs muted">{formatDate(a.created_at, true)} · {labelFor(people, a.actor_id, t.system)}</div>
                  {a.action === "UPDATE" && a.old_data && a.new_data && (
                    <div className="xs">{Object.keys(a.new_data).filter((k) => k !== "updated_at" && JSON.stringify(a.new_data?.[k]) !== JSON.stringify(a.old_data?.[k])).slice(0, 8).map(fl).join(", ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/auditoria?registro=${id}`} className="small">{t.fullAudit}</Link>
        </section>
      </div>
    </>
  );
}

function ChangeDiff({ changes, property, priv, prices, i }: { changes: ChangeSet; property: Dict; priv: Dict | null; prices: PriceRow[]; i: Dictionary }) {
  const t = i.admin.prop;
  const rows = buildChangeDiff(changes ?? {}, { property, private: priv, prices }, { text: diffText(i) });
  if (!rows.length) return <p className="small muted">{t.noDiff}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>{t.section}</th><th>{t.field}</th><th>{t.current}</th><th>{t.proposed}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.section}-${r.field}`}>
              <td className="small">{i.admin.diff.sections[r.section] ?? r.section}</td>
              <td>{r.label}{!r.applied && <div className="xs muted">{t.notApplied}</div>}</td>
              <td className="small" style={{ whiteSpace: "pre-wrap", maxWidth: 280 }}><del>{r.before}</del></td>
              <td className="small" style={{ whiteSpace: "pre-wrap", maxWidth: 280 }}><ins>{r.after}</ins></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
