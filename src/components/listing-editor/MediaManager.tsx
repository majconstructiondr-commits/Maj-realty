"use client";
// Paso 6: fotos y planos (comprimidos a WebP en el navegador, sin EXIF), video y recorrido por enlace https.
import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addExternalMedia, addPhoto, deleteMedia, discardUpload, moveMedia, setCover, type SimpleResult,
} from "@/app/panel/publicaciones/editor-actions";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { compressImage, IMAGE_TYPES, MAX_IMAGE_BYTES, safeFileName } from "@/lib/upload";
import type { EditorMedia } from "@/lib/listing-editor/types";
import { fmt, usePrivateI18n } from "@/i18n/client";
import { FieldErr, SelectField, TextField, describedBy } from "./fields";

export function MediaManager({ propertyId, media, live }: { propertyId: string; media: EditorMedia[]; live: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<SimpleResult | null>(null);
  const [busy, startBusy] = useTransition();
  const t = usePrivateI18n().d.editor.media;
  const KIND_LABEL = t.kinds;
  const images = media.filter((m) => m.kind === "foto" || m.kind === "plano");
  const links = media.filter((m) => m.kind === "video" || m.kind === "recorrido");

  const run = (fn: () => Promise<SimpleResult>) =>
    startBusy(async () => {
      const r = await fn();
      setMsg(r);
      if (r.ok) router.refresh();
    });

  return (
    <div className="form">
      <p className="small muted" style={{ margin: 0 }}>
        {t.intro}
        {live ? t.introLive : ""}
      </p>
      <UploadForm propertyId={propertyId} onDone={(r) => { setMsg(r); if (r.ok) router.refresh(); }} />

      <div aria-live="polite">{msg ? <p className={`alert ${msg.ok ? "alert-success" : "alert-error"}`} role={msg.ok ? "status" : "alert"}>{msg.message}</p> : null}</div>

      <section aria-labelledby="media-list">
        <h3 id="media-list">{fmt(t.images, { n: images.length })}</h3>
        {!images.length ? <p className="empty">{t.noImages}</p> : null}
        <ol className="le-media-list">
          {images.map((m, i) => (
            <li key={m.id} className="card le-media-item">
              <div className="le-thumb">
                {m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt_text} loading="lazy" width={m.width ?? undefined} height={m.height ?? undefined} />
                ) : (
                  <span className="xs muted">{t.noPreview}</span>
                )}
              </div>
              <div className="le-media-body">
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge">{KIND_LABEL[m.kind]} {i + 1}</span>
                  {m.is_cover ? <span className="badge badge-gold">{t.cover}</span> : null}
                  {!m.approved ? <span className="badge badge-warning">{t.pendingApproval}</span> : <span className="badge badge-success">{t.approved}</span>}
                </div>
                <p className="small" style={{ margin: "6px 0" }}>{m.alt_text}</p>
                <p className="xs muted" style={{ margin: 0 }}>{m.width && m.height ? `${m.width} × ${m.height} px` : ""}</p>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy || i === 0} aria-label={fmt(t.moveUpAria, { kind: KIND_LABEL[m.kind].toLowerCase(), n: i + 1 })}
                    onClick={() => run(() => moveMedia({ propertyId, mediaId: m.id, direction: "up" }))}>{t.moveUp}</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy || i === images.length - 1} aria-label={fmt(t.moveDownAria, { kind: KIND_LABEL[m.kind].toLowerCase(), n: i + 1 })}
                    onClick={() => run(() => moveMedia({ propertyId, mediaId: m.id, direction: "down" }))}>{t.moveDown}</button>
                  {m.kind === "foto" && !m.is_cover ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => setCover({ propertyId, mediaId: m.id }))}>{t.useAsCover}</button>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} style={{ color: "var(--danger)" }}
                    onClick={() => { if (confirm(t.confirmDeleteImage)) run(() => deleteMedia({ propertyId, mediaId: m.id })); }}>{t.delete}</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="links-list">
        <h3 id="links-list">{t.links}</h3>
        {links.length ? (
          <ul className="le-link-list">
            {links.map((m) => (
              <li key={m.id} className="row-between">
                <span>
                  <span className="badge">{KIND_LABEL[m.kind]}</span>{" "}
                  <a href={m.external_url!} target="_blank" rel="noopener noreferrer">{m.alt_text || m.external_url}</a>
                  {!m.approved ? <span className="badge badge-warning" style={{ marginLeft: 6 }}>{t.pending}</span> : null}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} style={{ color: "var(--danger)" }}
                  onClick={() => { if (confirm(t.confirmDeleteLink)) run(() => deleteMedia({ propertyId, mediaId: m.id })); }}>{t.delete}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">{t.noLinks}</p>
        )}
        <ExternalForm propertyId={propertyId} onDone={() => router.refresh()} />
      </section>
    </div>
  );
}

function UploadForm({ propertyId, onDone }: { propertyId: string; onDone: (r: SimpleResult) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [alts, setAlts] = useState<string[]>([]);
  // Vista previa local (object URL) de cada imagen elegida, para identificarla al escribir su descripción.
  const [previews, setPreviews] = useState<string[]>([]);
  const previewsRef = useRef<string[]>([]);
  const [kind, setKind] = useState<"foto" | "plano">("foto");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = usePrivateI18n().d.editor.media;

  function showPreviews(next: string[]) {
    previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewsRef.current = next;
    setPreviews(next);
  }
  useEffect(() => () => previewsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function remove(i: number) {
    URL.revokeObjectURL(previews[i]);
    previewsRef.current = previews.filter((_, j) => j !== i);
    setPreviews(previewsRef.current);
    setFiles((f) => f.filter((_, j) => j !== i));
    setAlts((a) => a.filter((_, j) => j !== i));
    if (files.length === 1 && inputRef.current) inputRef.current.value = "";
  }

  function pick(list: FileList | null) {
    setError(null);
    const arr = Array.from(list ?? []);
    const bad = arr.filter((f) => !IMAGE_TYPES.includes(f.type));
    if (bad.length) {
      setError(fmt(t.notAccepted, { files: bad.map((f) => f.name).join(", ") }));
    }
    const ok = arr.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_BYTES * 3).slice(0, 20);
    setFiles(ok);
    setAlts(ok.map(() => ""));
    showPreviews(ok.map((f) => URL.createObjectURL(f)));
  }

  async function upload() {
    setError(null);
    const missing = alts.findIndex((a) => a.trim().length < 3);
    if (missing >= 0) {
      setError(fmt(t.altMissing, { n: missing + 1 }));
      document.getElementById(`alt-${missing}`)?.focus();
      return;
    }
    const supabase = createClient();
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(fmt(t.processing, { i: i + 1, total: files.length, name: f.name }));
      let path: string | null = null;
      try {
        const { blob, width, height } = await compressImage(f);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error(t.tooLarge);
        path = `properties/${propertyId}/${safeFileName(f.name.replace(/\.[^.]+$/, "") + ".webp")}`;
        const up = await supabase.storage.from("property-media").upload(path, blob, { contentType: "image/webp", upsert: false });
        if (up.error) throw new Error(t.uploadFailed);
        const r = await addPhoto({ propertyId, kind, storagePath: path, width, height, altText: alts[i] });
        if (!r.ok) throw new Error(r.message);
        ok++;
      } catch (e) {
        failed.push(`${f.name} (${(e as Error).message})`);
        if (path) await discardUpload({ propertyId, storagePath: path }).catch(() => undefined);
      }
    }
    setProgress(null);
    setFiles([]);
    setAlts([]);
    showPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
    onDone(
      failed.length
        ? { ok: false, message: fmt(t.addedPartial, { n: ok, failed: failed.join("; ") }) }
        : { ok: true, message: fmt(t.added, { n: ok }) },
    );
  }

  return (
    <fieldset className="fieldset">
      <legend>{t.addTitle}</legend>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="media-kind">{t.kind}</label>
          <select id="media-kind" className="select" value={kind} onChange={(e) => setKind(e.currentTarget.value as "foto" | "plano")}>
            <option value="foto">{t.photo}</option>
            <option value="plano">{t.plan}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="media-files">{t.files}</label>
          <input ref={inputRef} id="media-files" type="file" accept="image/jpeg,image/png,image/webp" multiple className="input"
            onChange={(e) => pick(e.currentTarget.files)} aria-describedby="media-files-hint" />
          <span className="hint" id="media-files-hint">{t.filesHint}</span>
        </div>
      </div>
      {files.length ? (
        <div className="form" style={{ marginTop: 12 }}>
          <ol className="le-media-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="card le-media-item le-media-item--pick">
                <div className="le-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previews[i] ? <img src={previews[i]} alt={fmt(t.previewAlt, { n: i + 1 })} /> : null}
                </div>
                <div className="le-media-body field">
                  <label htmlFor={`alt-${i}`} className="required">{fmt(t.altLabel, { n: i + 1 })}</label>
                  <input id={`alt-${i}`} className="input" maxLength={200} value={alts[i] ?? ""} placeholder={t.altPlaceholder}
                    onChange={(e) => { const v = e.currentTarget.value; setAlts((a) => a.map((x, j) => (j === i ? v : x))); }} />
                  <div>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(progress)} onClick={() => remove(i)}>{t.remove}</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div>
            <button type="button" className="btn btn-primary" disabled={Boolean(progress)} aria-busy={Boolean(progress)} onClick={upload}>
              {progress ? t.uploading : fmt(t.uploadN, { n: files.length })}
            </button>
          </div>
        </div>
      ) : null}
      <div aria-live="polite">
        {progress ? <p className="small">{progress}</p> : null}
        {error ? <p className="alert alert-error small" role="alert">{error}</p> : null}
      </div>
    </fieldset>
  );
}

function ExternalForm({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (p, fd) => {
    const r = await addExternalMedia(p, fd);
    if (r.status === "ok") onDone();
    return r;
  }, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  const t = usePrivateI18n().d.editor.media;
  return (
    <form
      className="fieldset form"
      style={{ marginTop: 12 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="form-grid">
        <SelectField name="kind" label={t.linkKind} options={{ video: t.kinds.video, recorrido: t.kinds.recorrido }} defaultValue="video" errors={errors} />
        <div className="field">
          <label htmlFor="f-external_url" className="required">{t.link}</label>
          <input id="f-external_url" name="external_url" type="url" className="input" placeholder="https://" maxLength={500} required {...describedBy("external_url", errors)} />
          <FieldErr errors={errors} name="external_url" />
        </div>
        <TextField className="span-2" name="alt_text" label={t.description} required maxLength={200} errors={errors} placeholder={t.linkPlaceholder} />
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" className="btn btn-ghost" disabled={pending}>{pending ? t.adding : t.addLink}</button>
      </div>
    </form>
  );
}
