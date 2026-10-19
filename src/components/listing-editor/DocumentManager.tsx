"use client";
// Documentos privados del inmueble (bucket privado). Las descargas usan enlaces firmados de corta duración
// generados en el servidor al hacer clic.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocument, deleteDocument, type SimpleResult } from "@/app/panel/publicaciones/editor-actions";
import { formatDate } from "@/lib/format";
import { DOC_TYPES_LABELS, type DocType } from "@/lib/listing-editor/schemas";
import { usePrivateI18n } from "@/i18n/client";
import type { EditorDocument } from "@/lib/listing-editor/types";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";

const REVIEW_BADGE = { pendiente: "badge-warning", revisado: "badge-success", observado: "badge-danger" } as const;

export function DocumentManager({ propertyId, documents, live }: { propertyId: string; documents: EditorDocument[]; live: boolean }) {
  const router = useRouter();
  const [docType, setDocType] = useState<DocType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<SimpleResult | null>(null);
  const [busy, startBusy] = useTransition();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { d: dict } = usePrivateI18n();
  const t = dict.editor.docs;

  async function upload() {
    setMsg(null);
    if (!docType) return setMsg({ ok: false, message: t.pickType });
    if (!file) return setMsg({ ok: false, message: t.pickFile });
    if (!DOC_TYPES.includes(file.type)) return setMsg({ ok: false, message: t.badFormat });
    setUploading(true);
    try {
      let body: Blob = file;
      let mime = file.type;
      let name = file.name;
      if (IMAGE_TYPES.includes(file.type)) {
        body = (await compressImage(file, 2400, 0.85)).blob;
        mime = "image/webp";
        name = file.name.replace(/\.[^.]+$/, "") + ".webp";
      }
      if (body.size > MAX_DOC_BYTES) throw new Error(t.tooLarge);
      const path = `properties/${propertyId}/${safeFileName(name)}`;
      const up = await createClient().storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
      if (up.error) throw new Error(t.uploadFailed);
      const r = await addDocument({ propertyId, docType, storagePath: path, fileName: name.slice(-200) });
      setMsg(r);
      if (r.ok) {
        setFile(null);
        setDocType("");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch (e) {
      setMsg({ ok: false, message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="fieldset" aria-labelledby="docs-title">
      <h3 id="docs-title" style={{ marginTop: 0 }}>{t.title}</h3>
      <p className="small muted">
        {t.intro}
        {live ? t.introLive : ""}
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="doc-type" className="required">{t.type}</label>
          <select id="doc-type" className="select" value={docType} onChange={(e) => setDocType(e.currentTarget.value as DocType)}>
            <option value="">{dict.editor.form.select}</option>
            {Object.keys(DOC_TYPES_LABELS).map((k) => (
              <option key={k} value={k}>{dict.editor.docTypes[k]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-file" className="required">{t.file}</label>
          <input ref={inputRef} id="doc-file" type="file" className="input" accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} aria-describedby="doc-file-hint" />
          <span className="hint" id="doc-file-hint">{t.fileHint}</span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-outline" onClick={upload} disabled={uploading} aria-busy={uploading}>
          {uploading ? t.uploading : t.upload}
        </button>
      </div>
      <div aria-live="polite">
        {msg ? <p className={`alert small ${msg.ok ? "alert-success" : "alert-error"}`} role={msg.ok ? "status" : "alert"} style={{ marginTop: 10 }}>{msg.message}</p> : null}
      </div>

      {documents.length ? (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr><th scope="col">{t.document}</th><th scope="col">{t.file}</th><th scope="col">{t.status}</th><th scope="col">{t.date}</th><th scope="col"><span className="sr-only">{t.actions}</span></th></tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{dict.editor.docTypes[d.doc_type] ?? d.doc_type}</td>
                  <td>
                    <a href={`/panel/publicaciones/${propertyId}/documentos/${d.id}`} rel="noopener" target="_blank">{d.file_name}</a>
                    <span className="xs muted" style={{ display: "block" }}>{Math.max(1, Math.round(d.size_bytes / 1024))} KB</span>
                  </td>
                  <td>
                    <span className={`badge ${REVIEW_BADGE[d.review_status]}`}>{t.review[d.review_status]}</span>
                    {d.review_notes ? <span className="xs" style={{ display: "block", marginTop: 4 }}>{d.review_notes}</span> : null}
                  </td>
                  <td className="small">{formatDate(d.created_at)}</td>
                  <td>
                    {d.review_status === "pendiente" ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                        onClick={() => {
                          if (!confirm(t.confirmWithdraw)) return;
                          startBusy(async () => {
                            const r = await deleteDocument({ propertyId, documentId: d.id });
                            setMsg(r);
                            if (r.ok) router.refresh();
                          });
                        }}>{t.withdraw}</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small muted" style={{ marginTop: 12 }}>{t.none}</p>
      )}
    </section>
  );
}
