import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, DetailBoxes, FileLink, PageHeader } from "@/components/admin/Bits";
import { MobilePreview } from "@/components/admin/MobilePreview";
import { buildChangeDiff, FIELD_LABELS, type ChangeSet, type PriceRow } from "@/lib/admin/diff";
import { DOC_REVIEW, DOC_TYPES, LICENSE_STATUSES, OPERATIONS, PROPERTY_TYPES, STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { localDay } from "@/lib/admin/time";
import { CONDITIONS, FEATURES, NUMERIC_FIELDS, SPACE_FIELDS, TRI } from "@/lib/catalog/definitions";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import {
  approveMedia, approveProperty, clearDocumentsReviewed, markDocumentsReviewed, pauseProperty, rejectProperty,
  reviewChange, reviewDocument, saveStaffNotes, setAdvisor, setMajListing, setPropertyStatus,
} from "../actions";

type Dict = Record<string, unknown>;

const PRIVATE_HIDDEN = ["property_id", "updated_at", "staff_notes"];

export default async function PropertyReview(props: PageProps<"/admin/inmuebles/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/inmuebles/${id}`);

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

  const publicFacts: Dict = {
    Operación: labelOf(OPERATIONS, prop.operation as string),
    Tipo: labelOf(PROPERTY_TYPES, prop.property_type as string),
    Condición: labelOf(CONDITIONS, prop.condition as string),
    Ubicación: [prop.sector, prop.municipality, prop.province].filter(Boolean).join(", "),
    "Coordenadas aproximadas": prop.approx_lat ? `${prop.approx_lat}, ${prop.approx_lng}` : null,
    "Dirección pública": prop.exact_address_public ? prop.public_address : "No se publica",
    "Disponible desde": prop.available_from ? formatDate(prop.available_from as string) : null,
    ...Object.fromEntries(Object.entries(NUMERIC_FIELDS).map(([k, v]) => [v.label, (prop.na_fields as string[] | undefined)?.includes(k) ? "No aplica" : prop[k] === null ? "Desconocido" : `${formatNumber(prop[k] as number, 2)} ${v.unit}`.trim()])),
    ...Object.fromEntries(Object.entries(SPACE_FIELDS).map(([k, v]) => [v, labelOf(TRI, prop[k] as string)])),
    "Uso del techo": prop.roof_use_detail,
    "Reglas del condominio": prop.condo_rules,
    Restricciones: prop.restrictions,
  };

  return (
    <>
      <PageHeader title={`${prop.code} · ${prop.title}`} back={{ href: "/admin/inmuebles", label: "Inmuebles" }}>
        <Badge value={prop.status} map={STATUSES} />
        {prop.is_maj_listing && <span className="badge badge-navy">Publicación MAJ</span>}
        {prop.is_demo ? <span className="badge badge-demo">Demostración</span> : null}
        <Link href={`/panel/publicaciones/${id}/editar`} className="btn btn-ghost btn-sm">Abrir editor</Link>
        {isPublic.data === true && (<><Link href={publicHref} className="btn btn-ghost btn-sm" target="_blank">Ver ficha pública</Link><MobilePreview href={publicHref} /></>)}
      </PageHeader>

      {(dups.data ?? []).length > 0 && (
        <div className="alert alert-warning">
          <strong>Posibles duplicados</strong> (misma dirección y unidad):{" "}
          {(dups.data as { property_id: string; code: string; title: string; status: string }[]).map((d) => (
            <Link key={d.property_id} href={`/admin/inmuebles/${d.property_id}`} style={{ marginRight: 8 }}>{d.code} ({labelOf(STATUSES, d.status)})</Link>
          ))}
        </div>
      )}

      <section className="card card-body stack" aria-labelledby="rev">
        <h2 id="rev">Revisión</h2>
        <p className="small muted">
          Enviado: {formatDate(prop.submitted_at as string, true) || "—"} · Revisado: {formatDate(prop.reviewed_at as string, true) || "—"}
          {prop.rejection_reason ? <> · Último motivo de rechazo: {String(prop.rejection_reason)}</> : null}
          {prop.pause_reason ? <> · Motivo de pausa: {String(prop.pause_reason)}</> : null}
        </p>
        <div className="grid-3">
          {["en_revision", "pausado", "rechazado", "reservado"].includes(prop.status) && (
            <ActionForm action={approveProperty} submit="Aprobar y publicar" confirm="¿Aprobar y publicar esta ficha?">
              <input type="hidden" name="id" value={id} />
              <p className="small">Al aprobar desde revisión se aprueba también la multimedia pendiente. Requiere licencia vigente salvo publicaciones MAJ.</p>
            </ActionForm>
          )}
          {prop.status !== "rechazado" && prop.status !== "archivado" && (
            <ActionForm action={rejectProperty} submit="Rechazar" buttonClass="btn btn-danger">
              <input type="hidden" name="id" value={id} />
              <div className="field"><label htmlFor="rej" className="required">Motivo del rechazo</label><textarea id="rej" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          )}
          {["publicado", "reservado", "en_revision"].includes(prop.status) && (
            <ActionForm action={pauseProperty} submit="Pausar" buttonClass="btn btn-outline">
              <input type="hidden" name="id" value={id} />
              <div className="field"><label htmlFor="pau" className="required">Motivo de la pausa</label><textarea id="pau" name="reason" className="textarea" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          )}
        </div>
        <ActionForm action={setPropertyStatus} submit="Cambiar estado" buttonClass="btn btn-ghost" inline confirm="¿Confirmar el cambio de estado?">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="st" className="small">Cierre / archivo:</label>
          <select id="st" name="status" className="select" style={{ maxWidth: 200 }} defaultValue="vendido">
            <option value="reservado">Reservado</option><option value="vendido">Vendido (cierre confirmado)</option>
            <option value="rentado">Rentado (cierre confirmado)</option><option value="archivado">Archivado</option>
          </select>
          <input name="reason" className="input" style={{ maxWidth: 260 }} placeholder="Nota (opcional)" maxLength={500} />
        </ActionForm>
      </section>

      {pending && (
        <section className="card card-body stack" style={{ marginTop: 16 }} aria-labelledby="chg">
          <h2 id="chg">Cambios pendientes de revisión</h2>
          <p className="small muted">Solicitado por {labelFor(people, pending.requested_by)} el {formatDate(pending.created_at, true)}. La versión publicada se mantiene hasta aprobar.</p>
          <ChangeDiff changes={pending.changes} property={prop} priv={privRow} prices={priceRows} />
          <div className="grid-2">
            <ActionForm action={reviewChange} submit="Aprobar cambios" confirm="¿Aplicar estos cambios a la publicación?">
              <input type="hidden" name="request_id" value={pending.id} /><input type="hidden" name="property_id" value={id} /><input type="hidden" name="decision" value="aprobar" />
              <div className="field"><label htmlFor="cr-ok">Comentario (opcional)</label><input id="cr-ok" name="reason" className="input" maxLength={2000} /></div>
            </ActionForm>
            <ActionForm action={reviewChange} submit="Rechazar cambios" buttonClass="btn btn-danger">
              <input type="hidden" name="request_id" value={pending.id} /><input type="hidden" name="property_id" value={id} /><input type="hidden" name="decision" value="rechazar" />
              <div className="field"><label htmlFor="cr-no" className="required">Motivo</label><input id="cr-no" name="reason" className="input" required minLength={3} maxLength={2000} /></div>
            </ActionForm>
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card card-body stack">
          <h2>Titularidad</h2>
          <p className="small">
            Titular: <strong>{ownerLabel?.full_name || "—"}</strong> {ownerLabel?.email && <>· {ownerLabel.email}</>} <Link href={`/admin/usuarios/${prop.owner_user_id}`}>ver usuario</Link><br />
            Organización: {org.data ? `${(org.data as Dict).name} (${(org.data as Dict).status})` : "—"}<br />
            Licencia: {license.data ? <Link href={`/admin/licencias/${(license.data as Dict).id}`}>{String((license.data as Dict).code)}</Link> : prop.is_maj_listing ? "No requiere (MAJ)" : "Sin asignar"}
            {license.data ? <> · {labelOf(LICENSE_STATUSES, (license.data as Dict).status as string)} · vence {formatDate((license.data as Dict).ends_at as string)}</> : null}
          </p>
          <ActionForm action={setAdvisor} submit="Guardar asesor" buttonClass="btn btn-ghost btn-sm">
            <input type="hidden" name="id" value={id} />
            <div className="field">
              <label htmlFor="adv">Asesor asignado</label>
              <select id="adv" name="advisor_id" className="select" defaultValue={prop.advisor_id ?? ""}>
                <option value="">Sin asesor</option>
                {((advisors.data ?? []) as { id: string; display_name: string; is_active: boolean }[]).map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}{a.is_active ? "" : " (inactivo)"}</option>
                ))}
              </select>
            </div>
          </ActionForm>
          <ActionForm action={setMajListing} submit={prop.is_maj_listing ? "Quitar marca MAJ" : "Marcar como publicación de MAJ"} buttonClass="btn btn-ghost btn-sm"
            confirm={prop.is_maj_listing ? "La publicación volverá a requerir licencia vigente. ¿Continuar?" : "Solo para inmuebles que MAJ publica directamente (no consume licencia). ¿Continuar?"}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="value" value={prop.is_maj_listing ? "false" : "true"} />
          </ActionForm>
          <h3>Estadísticas</h3>
          <p className="small">Vistas: {formatNumber(views.count ?? 0)} · Clics WhatsApp: {formatNumber(clicks.count ?? 0)} · Compartidos: {formatNumber(shares.count ?? 0)}</p>
          <p className="xs muted">Indicadores de interés: no son contactos ni ventas.</p>
        </section>

        <section className="card card-body stack">
          <h2>Precios</h2>
          {priceRows.length === 0 ? <p className="muted">Sin precios.</p> : priceRows.map((x) => (
            <div key={String(x.id)} className="box">
              <span className="box-label">{x.operation === "venta" ? "Venta" : `Renta ${x.rent_period ? `(${x.rent_period})` : ""}`}</span>
              <span className="box-value">{formatMoney(x.amount, x.currency)} {x.negotiable ? "· negociable" : ""}</span>
              {x.maintenance_amount != null && <span className="small">Mantenimiento: {formatMoney(x.maintenance_amount as number, x.maintenance_currency as Currency)}</span>}
            </div>
          ))}
        </section>
      </div>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Ficha pública</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{String(prop.description ?? "")}</p>
        <DetailBoxes data={publicFacts} />
        {Object.keys(features).length > 0 && (
          <>
            <h3>Características</h3>
            <DetailBoxes data={Object.fromEntries(Object.entries(features).map(([k, v]) => [FEATURES[k]?.label ?? k, `${labelOf(TRI, v.v)}${v.d ? ` · ${v.d}` : ""}`]))} />
          </>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Datos privados (solo personal)</h2>
        <p className="small muted">Información declarada por el publicador; no está verificada por MAJ salvo revisión documental registrada.</p>
        {privRow ? (
          <DetailBoxes data={Object.fromEntries(Object.entries(privRow).filter(([k]) => !PRIVATE_HIDDEN.includes(k)).map(([k, v]) => [FIELD_LABELS[k] ?? k, v]))} />
        ) : <p className="muted">Sin datos privados.</p>}
        <ActionForm action={saveStaffNotes} submit="Guardar notas internas" buttonClass="btn btn-ghost btn-sm">
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="sn">Notas internas del personal</label><textarea id="sn" name="staff_notes" className="textarea" maxLength={4000} defaultValue={(privRow?.staff_notes as string) ?? ""} /></div>
        </ActionForm>
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <div className="row-between">
          <h2>Multimedia ({mediaRows.length})</h2>
          {pendingMedia > 0 && (
            <ActionForm action={approveMedia} submit={`Aprobar todo lo pendiente (${pendingMedia})`} buttonClass="btn btn-primary btn-sm" inline>
              <input type="hidden" name="property_id" value={id} />
            </ActionForm>
          )}
        </div>
        {mediaRows.length === 0 ? <p className="muted">Sin multimedia.</p> : (
          <div className="grid-4">
            {mediaRows.map((m) => (
              <div key={m.id} className="card">
                {m.storage_path && signed.get(m.storage_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={signed.get(m.storage_path)} alt={m.alt_text || "Imagen del inmueble"} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                ) : m.external_url ? <a href={m.external_url} target="_blank" rel="noopener noreferrer" className="card-body">{m.kind}: enlace externo</a> : <div className="card-body muted">Sin vista previa</div>}
                <div className="card-body small">
                  {m.is_cover && <span className="badge badge-gold">Portada</span>}{" "}
                  {m.approved ? <span className="badge badge-success">Aprobada</span> : <span className="badge badge-warning">Pendiente</span>}
                  {!m.approved && (
                    <ActionForm action={approveMedia} submit="Aprobar" buttonClass="btn btn-ghost btn-sm">
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
        <h2>Documentos</h2>
        <div className="alert alert-info small">
          {prop.documents_reviewed_at ? (
            <>Revisión documental por MAJ el {formatDate(prop.documents_reviewed_at as string)}: <strong>{String(prop.documents_review_scope ?? "")}</strong></>
          ) : "Sin revisión documental registrada. Solo márquela después de revisar realmente los documentos."}
        </div>
        <div className="grid-2">
          <ActionForm action={markDocumentsReviewed} submit="Registrar revisión documental" confirm="Esto se mostrará en la ficha pública con el alcance indicado. ¿Confirmar?">
            <input type="hidden" name="id" value={id} />
            <div className="field"><label htmlFor="drd" className="required">Fecha de revisión</label><input id="drd" type="date" name="reviewed_at" className="input" defaultValue={localDay(new Date())} required /></div>
            <div className="field">
              <label htmlFor="drs" className="required">Alcance de la revisión</label>
              <input id="drs" name="scope" className="input" required minLength={10} maxLength={300} defaultValue={(prop.documents_review_scope as string) ?? ""} placeholder="Certificado de título y certificación del estado jurídico" />
              <span className="hint">Describa exactamente qué documentos se revisaron.</span>
            </div>
          </ActionForm>
          {prop.documents_reviewed_at ? (
            <ActionForm action={clearDocumentsReviewed} submit="Retirar marca de revisión" buttonClass="btn btn-ghost btn-sm" confirm="¿Retirar la marca de revisión documental?">
              <input type="hidden" name="id" value={id} />
            </ActionForm>
          ) : null}
        </div>
        {docRows.length === 0 ? <p className="muted">No hay documentos cargados.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Documento</th><th>Cargado</th><th>Estado</th><th>Revisión</th></tr></thead>
              <tbody>
                {docRows.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{labelOf(DOC_TYPES, d.doc_type)}</strong><div className="small"><FileLink path={d.storage_path}>{d.file_name}</FileLink></div></td>
                    <td className="small">{formatDate(d.created_at, true)}<div>{labelFor(people, d.uploaded_by)}</div></td>
                    <td><Badge value={d.review_status} map={DOC_REVIEW} />{d.review_notes && <div className="small">{d.review_notes}</div>}{d.reviewed_at && <div className="xs muted">{labelFor(people, d.reviewed_by)} · {formatDate(d.reviewed_at, true)}</div>}</td>
                    <td>
                      <ActionForm action={reviewDocument} submit="Guardar" buttonClass="btn btn-ghost btn-sm">
                        <input type="hidden" name="id" value={d.id} /><input type="hidden" name="property_id" value={id} />
                        <select name="review_status" className="select" aria-label="Resultado" defaultValue={d.review_status === "observado" ? "observado" : "revisado"}>
                          <option value="revisado">Revisado</option><option value="observado">Observado</option>
                        </select>
                        <input name="review_notes" className="input" aria-label="Notas" placeholder="Notas / observación" maxLength={2000} defaultValue={d.review_notes ?? ""} />
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
          <h2>Historial de revisión</h2>
          {reviewRows.length === 0 ? <p className="muted">Sin historial.</p> : (
            <ul className="timeline">
              {reviewRows.map((r) => (
                <li key={r.id}>
                  <strong>{r.action.replace(/_/g, " ")}</strong>{r.from_status || r.to_status ? `: ${labelOf(STATUSES, r.from_status)} → ${labelOf(STATUSES, r.to_status)}` : ""}
                  {r.reason && <div className="small">Motivo: {r.reason}</div>}
                  <div className="xs muted">{formatDate(r.created_at, true)} · {labelFor(people, r.actor_id, "Sistema")}</div>
                </li>
              ))}
            </ul>
          )}
          {changeRows.filter((c) => c.status !== "pendiente").length > 0 && (
            <>
              <h3>Solicitudes de cambio anteriores</h3>
              <ul className="timeline">
                {changeRows.filter((c) => c.status !== "pendiente").map((c) => (
                  <li key={c.id}>
                    <Badge value={c.status} /> {formatDate(c.created_at, true)} · {labelFor(people, c.requested_by)}
                    {c.review_reason && <div className="small">{c.review_reason}</div>}
                    <details><summary className="small">Ver cambios</summary><ChangeDiff changes={c.changes} property={prop} priv={privRow} prices={priceRows} /></details>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="card card-body stack">
          <h2>Auditoría</h2>
          {(audit ?? []).length === 0 ? <p className="muted">Sin entradas.</p> : (
            <ul className="timeline">
              {((audit ?? []) as { id: number; actor_id: string | null; action: string; table_name: string; created_at: string; new_data: Dict | null; old_data: Dict | null }[]).map((a) => (
                <li key={a.id}>
                  <strong>{a.action}</strong> · {a.table_name}
                  <div className="xs muted">{formatDate(a.created_at, true)} · {labelFor(people, a.actor_id, "Sistema")}</div>
                  {a.action === "UPDATE" && a.old_data && a.new_data && (
                    <div className="xs">{Object.keys(a.new_data).filter((k) => k !== "updated_at" && JSON.stringify(a.new_data?.[k]) !== JSON.stringify(a.old_data?.[k])).slice(0, 8).map((k) => FIELD_LABELS[k] ?? k).join(", ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/auditoria?registro=${id}`} className="small">Ver auditoría completa</Link>
        </section>
      </div>
    </>
  );
}

function ChangeDiff({ changes, property, priv, prices }: { changes: ChangeSet; property: Dict; priv: Dict | null; prices: PriceRow[] }) {
  const rows = buildChangeDiff(changes ?? {}, { property, private: priv, prices });
  if (!rows.length) return <p className="small muted">La solicitud no cambia valores respecto a la versión actual.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Sección</th><th>Campo</th><th>Actual</th><th>Propuesto</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.section}-${r.field}`}>
              <td className="small">{r.section}</td>
              <td>{r.label}{!r.applied && <div className="xs muted">No se aplica automáticamente</div>}</td>
              <td className="small" style={{ whiteSpace: "pre-wrap", maxWidth: 280 }}><del>{r.before}</del></td>
              <td className="small" style={{ whiteSpace: "pre-wrap", maxWidth: 280 }}><ins>{r.after}</ins></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
