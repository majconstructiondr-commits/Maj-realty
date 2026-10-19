import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import "@/components/listing-editor/editor.css";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  MISSING_STEP, STEPS, isLiveStatus, missingForReview, parseStep, type ChangeSet,
} from "@/lib/listing-editor/schemas";
import { loadEditorData, withPendingChanges, type EditorData } from "@/lib/listing-editor/server";
import { StatusBadge, StateBadge } from "@/components/listing-editor/StatusBadge";
import { StepBasics, StepDistribution, StepFeatures, StepLocation, StepPrices, StepPrivate } from "@/components/listing-editor/steps";
import { MediaManager } from "@/components/listing-editor/MediaManager";
import { DocumentManager } from "@/components/listing-editor/DocumentManager";
import { ListingPreview } from "@/components/listing-editor/ListingPreview";
import { SubmitReview } from "@/components/listing-editor/SubmitReview";
import { es, fmt, type Dictionary } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.editor.edit.meta, robots: { index: false, follow: false } };
}

function summarizeChanges(c: ChangeSet, d: Dictionary) {
  const t = d.editor.edit;
  return Object.keys(c)
    .map((k) => {
      const v = (c as Record<string, unknown>)[k];
      const n = Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
      return `${t.sections[k] ?? k}${k === "prices" ? "" : ` (${n === 1 ? t.fieldsOne : fmt(t.fields, { n })})`}`;
    })
    .join(", ");
}

/** Traduce un requisito de missingForReview (en español) al idioma activo. */
function missingLabel(label: string, d: Dictionary) {
  const key = (Object.keys(es.editor.missing) as (keyof Dictionary["editor"]["missing"])[]).find((k) => es.editor.missing[k] === label);
  return key ? d.editor.missing[key] : label;
}

export default async function EditListingPage(props: PageProps<"/panel/publicaciones/[id]/editar">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  await requireUser(`/panel/publicaciones/${id}/editar`);
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await loadEditorData(id);
  if (!data) notFound();

  const step = parseStep(sp.paso);
  const live = isLiveStatus(data.property.status);
  const view = live ? withPendingChanges(data) : { property: data.property, priv: data.priv, prices: data.prices, pending: null };
  const p = view.property;
  const lastReviewed = data.changeRequests.find((c) => c.status !== "pendiente" && c.status !== "retirado");
  const readOnly = !data.canEdit || ["archivado", "vendido", "rentado"].includes(data.property.status);
  const base = `/panel/publicaciones/${id}/editar`;
  const { d } = await getI18n();
  const t = d.editor.edit;
  const stepLabel = (key: string) => d.editor.steps[key] ?? key;

  return (
    <div className="section-sm">
      <nav aria-label={d.common.breadcrumb} className="small" style={{ marginBottom: 8 }}>
        <Link href="/panel/publicaciones">{t.back}</Link>
      </nav>
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{fmt(t.ref, { code: data.property.code })}</span>
          <h1 style={{ marginBottom: 4, overflowWrap: "anywhere" }}>{data.property.title}</h1>
        </div>
        <StatusBadge status={data.property.status} />
      </div>

      {data.property.status === "rechazado" && data.property.rejection_reason ? (
        <div className="alert alert-error" role="note" style={{ margin: "10px 0" }}>
          <strong>{t.rejection}</strong> {data.property.rejection_reason}
          <span className="small" style={{ display: "block" }}>{t.rejectionHelp}</span>
        </div>
      ) : null}
      {data.property.status === "pausado" && data.property.pause_reason ? (
        <p className="alert alert-warning small">{fmt(t.paused, { reason: data.property.pause_reason })}</p>
      ) : null}

      {live && !readOnly ? (
        <div className="alert alert-info small" role="note" style={{ margin: "10px 0" }}>
          <strong>{data.property.status === "en_revision" ? t.liveInReview : t.liveActive}</strong>{" "}
          {data.property.status === "en_revision" ? t.liveSentBody : t.livePublishedBody} {t.liveMedia}
          {data.property.status === "en_revision" ? t.liveWithdraw : ""}
        </div>
      ) : null}
      {view.pending ? (
        <div className="alert alert-warning small" role="status" style={{ margin: "10px 0" }}>
          {t.pendingBefore} <StateBadge value="pendiente" /> {fmt(t.pendingAfter, { date: formatDate(view.pending.created_at, true), summary: summarizeChanges(view.pending.changes, d) })}{" "}
          {t.pendingNote}
        </div>
      ) : null}
      {lastReviewed && !view.pending && lastReviewed.status === "rechazado" ? (
        <p className="alert alert-error small">
          {fmt(t.lastRejected, { date: formatDate(lastReviewed.reviewed_at, true) })}{lastReviewed.review_reason ? `: ${lastReviewed.review_reason}` : "."}
        </p>
      ) : null}
      {readOnly ? (
        <p className="alert alert-warning small">
          {data.canEdit
            ? t.closed
            : t.readOnly}
        </p>
      ) : null}

      <nav aria-label={t.stepsAria}>
        <ol className="stepper" style={{ marginTop: 14 }}>
          {STEPS.map((s) => (
            <li key={s.n}>
              <Link href={`${base}?paso=${s.n}`} aria-current={s.n === step ? "step" : undefined}>
                <span aria-hidden="true">{s.n}.</span> {stepLabel(s.key)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <h2 style={{ fontSize: "1.35rem" }}>
        {fmt(t.stepOf, { n: step, total: STEPS.length, label: stepLabel(STEPS[step - 1].key) })}
      </h2>

      {readOnly && step !== 8 ? (
        <ListingPreview p={p} prices={view.prices} media={data.media} idSuffix="ro" />
      ) : (
        <StepContent step={step} data={data} view={view} live={live} readOnly={readOnly} d={d} />
      )}

      <div className="row-between" style={{ marginTop: 18 }}>
        {step > 1 ? <Link className="btn btn-ghost btn-sm" href={`${base}?paso=${step - 1}`}>{t.prev}</Link> : <span />}
        {step < 8 ? <Link className="btn btn-ghost btn-sm" href={`${base}?paso=${step + 1}`}>{t.next}</Link> : null}
      </div>
    </div>
  );
}

function StepContent({ step, data, view, live, readOnly, d }: {
  step: number;
  d: Dictionary;
  data: EditorData;
  view: ReturnType<typeof withPendingChanges> | { property: EditorData["property"]; priv: EditorData["priv"]; prices: EditorData["prices"]; pending: null };
  live: boolean;
  readOnly: boolean;
}) {
  const id = data.property.id;
  const p = view.property;
  switch (step) {
    case 1:
      return <StepBasics propertyId={id} live={live} p={p} />;
    case 2:
      return <StepLocation propertyId={id} live={live} p={p} priv={view.priv} />;
    case 3:
      return <StepPrices propertyId={id} live={live} operation={p.operation} prices={view.prices} />;
    case 4:
      return <StepDistribution propertyId={id} live={live} p={p} />;
    case 5:
      return <StepFeatures propertyId={id} live={live} p={p} />;
    case 6:
      return (
        <>
          <MediaManager propertyId={id} media={data.media} live={live} />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <Link className="btn btn-primary" href={`/panel/publicaciones/${id}/editar?paso=7`}>{d.editor.edit.continue}</Link>
          </div>
        </>
      );
    case 7:
      return (
        <div className="form">
          <StepPrivate propertyId={id} live={live} priv={view.priv} propertyType={view.property.property_type} />
          <DocumentManager propertyId={id} documents={data.documents} live={live} />
        </div>
      );
    default:
      return <PreviewStep data={data} view={view} readOnly={readOnly} d={d} />;
  }
}

async function PreviewStep({ data, view, readOnly, d }: { data: EditorData; view: { property: EditorData["property"]; prices: EditorData["prices"] }; readOnly: boolean; d: Dictionary }) {
  const supabase = await createClient();
  const t = d.editor.edit;
  const prop = data.property;
  const missing = missingForReview({
    province: prop.province,
    municipality: prop.municipality,
    description: prop.description,
    operation: prop.operation,
    priceOperations: data.prices.map((x) => x.operation),
    photoCount: data.media.filter((m) => m.kind === "foto").length,
    publicationAuthorized: Boolean(data.priv?.publication_authorized),
  });
  const now = new Date().toISOString();
  let licQ = supabase.from("licenses").select("id, code, ends_at").eq("status", "activa").lte("starts_at", now).gt("ends_at", now);
  licQ = prop.organization_id ? licQ.eq("organization_id", prop.organization_id) : licQ.eq("holder_user_id", prop.owner_user_id);
  const [{ data: dups }, { data: lics }] = await Promise.all([
    supabase.rpc("possible_duplicates", { p_property: prop.id }),
    licQ.limit(1),
  ]);
  const duplicates = (dups ?? []) as { property_id: string; code: string; title: string; status: string }[];
  const license = (lics ?? [])[0] as { code: string; ends_at: string } | undefined;
  const canSubmit = ["borrador", "rechazado", "pausado"].includes(prop.status) && !readOnly;
  const checks = [
    ["provincia", 2], ["municipio", 2], ["descripción (mínimo 30 caracteres)", 1], ...(prop.operation !== "renta" ? [["precio de venta", 3]] : []),
    ...(prop.operation !== "venta" ? [["precio de renta", 3]] : []), ["al menos una foto", 6], ["autorización de publicación", 7],
  ] as [string, number][];

  return (
    <div className="form">
      <section className="card card-body" aria-labelledby="checklist-title">
        <h3 id="checklist-title">{t.checklist}</h3>
        <ul className="le-checklist">
          {checks.map(([label]) => {
            const miss = missing.includes(label);
            return (
              <li key={label}>
                <span className={miss ? "le-miss" : "le-ok"} aria-hidden="true">{miss ? "✗" : "✓"}</span>
                <span>
                  <span className="sr-only">{miss ? t.missing : t.complete}</span>
                  {missingLabel(label, d).charAt(0).toUpperCase() + missingLabel(label, d).slice(1)}
                  {miss ? <> — <Link href={`/panel/publicaciones/${prop.id}/editar?paso=${MISSING_STEP[label]}`}>{fmt(t.completeInStep, { n: MISSING_STEP[label] })}</Link></> : null}
                </span>
              </li>
            );
          })}
          <li>
            <span className={license || prop.is_maj_listing ? "le-ok" : "le-miss"} aria-hidden="true">{license || prop.is_maj_listing ? "✓" : "✗"}</span>
            <span>
              {prop.is_maj_listing ? (
                <>{t.majListing}</>
              ) : license ? (
                <>{fmt(t.activeLicense, { code: license.code, date: formatDate(license.ends_at) })}</>
              ) : (
                <>{t.licenseNeeded} — <Link href="/panel/licencia">{t.viewLicense}</Link></>
              )}
            </span>
          </li>
        </ul>
        {data.priv && !data.documents.some((d) => d.doc_type === "autorizacion_publicacion") ? (
          <p className="small muted" style={{ marginBottom: 0 }}>{t.recommendAuth}</p>
        ) : null}
      </section>

      {duplicates.length ? (
        <section className="alert alert-warning" aria-labelledby="dup-title">
          <h3 id="dup-title" style={{ marginTop: 0 }}>{t.duplicate}</h3>
          <p className="small">{t.duplicateBody}</p>
          <ul className="small">
            {duplicates.map((d) => (
              <li key={d.property_id}>{d.code} · {d.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="preview-title">
        <h3 id="preview-title">{t.preview}</h3>
        <p className="small muted">
          {isLiveStatus(prop.status) ? t.previewBodyLive : t.previewBody}
        </p>
        <div className="le-preview-grid">
          <div className="card card-body" style={{ minWidth: 0 }}>
            <p className="xs muted" style={{ marginTop: 0 }}>{t.wide}</p>
            <ListingPreview p={view.property} prices={view.prices} media={data.media} idSuffix="wide" />
          </div>
          <div>
            <div className="le-phone" role="region" aria-label={t.mobileAria}>
              <div className="le-phone-screen">
                <ListingPreview p={view.property} prices={view.prices} media={data.media} idSuffix="mobile" />
              </div>
            </div>
            <p className="le-phone-caption">{t.phoneCaption}</p>
          </div>
        </div>
      </section>

      {canSubmit ? (
        <section className="card card-body" aria-labelledby="send-title">
          <h3 id="send-title">{prop.status === "pausado" ? t.resend : t.send}</h3>
          {missing.length ? (
            <p className="alert alert-warning small">{fmt(t.completeMissing, { list: missing.map((m) => missingLabel(m, d)).join(", ") })}</p>
          ) : null}
          <SubmitReview propertyId={prop.id} disabled={missing.length > 0} label={prop.status === "pausado" ? t.resend : t.send} />
        </section>
      ) : (
        <p className="alert alert-info small">
          {prop.status === "en_revision"
            ? t.inReview
            : isLiveStatus(prop.status) && !readOnly
              ? t.activeUseSteps
              : t.cannotSubmit}
        </p>
      )}
    </div>
  );
}
