"use client";
// Paso 6: fotos y planos (comprimidos a WebP en el navegador, sin EXIF), video y recorrido por enlace https.
import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addExternalMedia, addPhoto, deleteMedia, discardUpload, moveMedia, setCover, type SimpleResult,
} from "@/app/panel/publicaciones/editor-actions";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { compressImage, IMAGE_TYPES, MAX_IMAGE_BYTES, safeFileName } from "@/lib/upload";
import type { EditorMedia } from "@/lib/listing-editor/types";
import { FieldErr, SelectField, TextField, describedBy } from "./fields";

const KIND_LABEL = { foto: "Foto", plano: "Plano", video: "Video", recorrido: "Recorrido virtual" } as const;

export function MediaManager({ propertyId, media, live }: { propertyId: string; media: EditorMedia[]; live: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<SimpleResult | null>(null);
  const [busy, startBusy] = useTransition();
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
        Suba fotos reales del inmueble (JPG, PNG o WebP). Las comprimimos en su dispositivo y eliminamos los metadatos (como la ubicación GPS) antes de subirlas.
        Los documentos en PDF se cargan en el paso 7, no aquí.
        {live ? " En una publicación activa, las imágenes nuevas quedan pendientes hasta que MAJ las apruebe." : ""}
      </p>
      <UploadForm propertyId={propertyId} onDone={(r) => { setMsg(r); if (r.ok) router.refresh(); }} />

      <div aria-live="polite">{msg ? <p className={`alert ${msg.ok ? "alert-success" : "alert-error"}`} role={msg.ok ? "status" : "alert"}>{msg.message}</p> : null}</div>

      <section aria-labelledby="media-list">
        <h3 id="media-list">Fotos y planos ({images.length})</h3>
        {!images.length ? <p className="empty">Aún no hay imágenes. Para enviar a revisión se necesita al menos una foto.</p> : null}
        <ol className="le-media-list">
          {images.map((m, i) => (
            <li key={m.id} className="card le-media-item">
              <div className="le-thumb">
                {m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.alt_text} loading="lazy" width={m.width ?? undefined} height={m.height ?? undefined} />
                ) : (
                  <span className="xs muted">Vista no disponible</span>
                )}
              </div>
              <div className="le-media-body">
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge">{KIND_LABEL[m.kind]} {i + 1}</span>
                  {m.is_cover ? <span className="badge badge-gold">Portada</span> : null}
                  {!m.approved ? <span className="badge badge-warning">Pendiente de aprobación</span> : <span className="badge badge-success">Aprobada</span>}
                </div>
                <p className="small" style={{ margin: "6px 0" }}>{m.alt_text}</p>
                <p className="xs muted" style={{ margin: 0 }}>{m.width && m.height ? `${m.width} × ${m.height} px` : ""}</p>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy || i === 0} aria-label={`Subir ${KIND_LABEL[m.kind].toLowerCase()} ${i + 1}`}
                    onClick={() => run(() => moveMedia({ propertyId, mediaId: m.id, direction: "up" }))}>↑ Subir</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy || i === images.length - 1} aria-label={`Bajar ${KIND_LABEL[m.kind].toLowerCase()} ${i + 1}`}
                    onClick={() => run(() => moveMedia({ propertyId, mediaId: m.id, direction: "down" }))}>↓ Bajar</button>
                  {m.kind === "foto" && !m.is_cover ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => setCover({ propertyId, mediaId: m.id }))}>Usar como portada</button>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} style={{ color: "var(--danger)" }}
                    onClick={() => { if (confirm("¿Eliminar esta imagen?")) run(() => deleteMedia({ propertyId, mediaId: m.id })); }}>Eliminar</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="links-list">
        <h3 id="links-list">Video y recorrido virtual</h3>
        {links.length ? (
          <ul className="le-link-list">
            {links.map((m) => (
              <li key={m.id} className="row-between">
                <span>
                  <span className="badge">{KIND_LABEL[m.kind]}</span>{" "}
                  <a href={m.external_url!} target="_blank" rel="noopener noreferrer">{m.alt_text || m.external_url}</a>
                  {!m.approved ? <span className="badge badge-warning" style={{ marginLeft: 6 }}>Pendiente</span> : null}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} style={{ color: "var(--danger)" }}
                  onClick={() => { if (confirm("¿Eliminar este enlace?")) run(() => deleteMedia({ propertyId, mediaId: m.id })); }}>Eliminar</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Sin enlaces.</p>
        )}
        <ExternalForm propertyId={propertyId} onDone={() => router.refresh()} />
      </section>
    </div>
  );
}

function UploadForm({ propertyId, onDone }: { propertyId: string; onDone: (r: SimpleResult) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [alts, setAlts] = useState<string[]>([]);
  const [kind, setKind] = useState<"foto" | "plano">("foto");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(list: FileList | null) {
    setError(null);
    const arr = Array.from(list ?? []);
    const bad = arr.filter((f) => !IMAGE_TYPES.includes(f.type));
    if (bad.length) {
      setError(`No se aceptan: ${bad.map((f) => f.name).join(", ")}. Aquí solo van imágenes JPG, PNG o WebP; los PDF se cargan en el paso 7 (documentos).`);
    }
    const ok = arr.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_BYTES * 3).slice(0, 20);
    setFiles(ok);
    setAlts(ok.map(() => ""));
  }

  async function upload() {
    setError(null);
    const missing = alts.findIndex((a) => a.trim().length < 3);
    if (missing >= 0) {
      setError(`Escriba una descripción (texto alternativo) para la imagen ${missing + 1}: ayuda a personas con lectores de pantalla.`);
      document.getElementById(`alt-${missing}`)?.focus();
      return;
    }
    const supabase = createClient();
    let ok = 0;
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`Procesando ${i + 1} de ${files.length}: ${f.name}`);
      let path: string | null = null;
      try {
        const { blob, width, height } = await compressImage(f);
        if (blob.size > MAX_IMAGE_BYTES) throw new Error("La imagen sigue siendo muy grande");
        path = `properties/${propertyId}/${safeFileName(f.name.replace(/\.[^.]+$/, "") + ".webp")}`;
        const up = await supabase.storage.from("property-media").upload(path, blob, { contentType: "image/webp", upsert: false });
        if (up.error) throw new Error("No se pudo subir");
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
    if (inputRef.current) inputRef.current.value = "";
    onDone(
      failed.length
        ? { ok: false, message: `Se agregaron ${ok} imagen(es). No se pudieron agregar: ${failed.join("; ")}.` }
        : { ok: true, message: `Se agregaron ${ok} imagen(es).` },
    );
  }

  return (
    <fieldset className="fieldset">
      <legend>Agregar fotos o planos</legend>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="media-kind">Tipo</label>
          <select id="media-kind" className="select" value={kind} onChange={(e) => setKind(e.currentTarget.value as "foto" | "plano")}>
            <option value="foto">Foto</option>
            <option value="plano">Plano (imagen)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="media-files">Archivos de imagen</label>
          <input ref={inputRef} id="media-files" type="file" accept="image/jpeg,image/png,image/webp" multiple className="input"
            onChange={(e) => pick(e.currentTarget.files)} aria-describedby="media-files-hint" />
          <span className="hint" id="media-files-hint">Hasta 20 por vez. Se reducen a un máximo de 2000 px.</span>
        </div>
      </div>
      {files.length ? (
        <div className="form" style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="field">
              <label htmlFor={`alt-${i}`} className="required">Descripción de “{f.name}”</label>
              <input id={`alt-${i}`} className="input" maxLength={200} value={alts[i] ?? ""} placeholder="Ej.: Sala con ventanal y vista al jardín"
                onChange={(e) => { const v = e.currentTarget.value; setAlts((a) => a.map((x, j) => (j === i ? v : x))); }} />
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-primary" disabled={Boolean(progress)} aria-busy={Boolean(progress)} onClick={upload}>
              {progress ? "Subiendo…" : `Subir ${files.length} imagen(es)`}
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
        <SelectField name="kind" label="Tipo de enlace" options={{ video: "Video", recorrido: "Recorrido virtual" }} defaultValue="video" errors={errors} />
        <div className="field">
          <label htmlFor="f-external_url" className="required">Enlace (https)</label>
          <input id="f-external_url" name="external_url" type="url" className="input" placeholder="https://" maxLength={500} required {...describedBy("external_url", errors)} />
          <FieldErr errors={errors} name="external_url" />
        </div>
        <TextField className="span-2" name="alt_text" label="Descripción" required maxLength={200} errors={errors} placeholder="Ej.: Recorrido por la sala y la cocina" />
      </div>
      <FormMessage state={state} />
      <div>
        <button type="submit" className="btn btn-ghost" disabled={pending}>{pending ? "Agregando…" : "Agregar enlace"}</button>
      </div>
    </form>
  );
}
