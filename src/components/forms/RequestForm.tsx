"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitServiceRequest, type RequestState } from "@/app/actions/requests";
import { env, hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { formatDate } from "@/lib/format";
import { CHANNELS } from "@/lib/catalog/definitions";
import { Turnstile } from "./Turnstile";

type Props = {
  kind: string;
  children?: React.ReactNode;
  propertyId?: string;
  propertyRef?: string;
  submitLabel?: string;
  allowFiles?: boolean;
  filesLabel?: string;
  defaultName?: string;
  defaultEmail?: string;
  messageLabel?: string;
  messageRequired?: boolean;
  compact?: boolean;
};

export function FieldError({ errors, name }: { errors?: Record<string, string>; name: string }) {
  if (!errors?.[name]) return null;
  return <span className="error" id={`${name}-error`}>{errors[name]}</span>;
}

export function RequestForm(p: Props) {
  const [state, action, pending] = useActionState<RequestState, FormData>(submitServiceRequest, { status: "idle" });
  const [files, setFiles] = useState<File[]>([]);
  const [uploadReport, setUploadReport] = useState<{ ok: number; failed: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [started, setStarted] = useState(0);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca de tiempo solo en el cliente
    setStarted(Date.now());
  }, []);

  useEffect(() => {
    if (state.status !== "ok" || handled.current === state.id) return;
    handled.current = state.id;
    if (!files.length) return;
    (async () => {
      setUploading(true);
      const supabase = createClient();
      const failed: string[] = [];
      let ok = 0;
      for (const f of files) {
        try {
          let body: Blob = f;
          let mime = f.type;
          let name = f.name;
          if (IMAGE_TYPES.includes(f.type)) {
            body = (await compressImage(f)).blob;
            mime = "image/webp";
            name = f.name.replace(/\.[^.]+$/, "") + ".webp";
          }
          if (body.size > MAX_DOC_BYTES) throw new Error("Archivo muy grande");
          const path = `requests/${state.id}/${state.uploadToken}/${safeFileName(name)}`;
          const up = await supabase.storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
          if (up.error) throw up.error;
          const reg = await supabase.rpc("attach_request_file", {
            p_request: state.id, p_token: state.uploadToken, p_path: path, p_name: name, p_mime: mime, p_size: body.size,
          });
          if (reg.error) throw reg.error;
          ok++;
        } catch {
          failed.push(f.name);
        }
      }
      setUploadReport({ ok, failed });
      setUploading(false);
    })();
  }, [state, files]);

  if (state.status === "ok") {
    return (
      <div className="alert alert-success" role="status" aria-live="polite">
        <h3 style={{ marginTop: 0 }}>Solicitud registrada</h3>
        <p>
          Número de seguimiento: <strong>{state.number}</strong>
          <br />
          Fecha: {formatDate(state.createdAt, true)}
        </p>
        {uploading ? <p>Adjuntando archivos…</p> : null}
        {uploadReport ? (
          uploadReport.failed.length ? (
            <p className="alert alert-warning">
              Se adjuntaron {uploadReport.ok} archivo(s). No se pudieron adjuntar: {uploadReport.failed.join(", ")}. Puede enviarlos por WhatsApp indicando su número de solicitud.
            </p>
          ) : (
            <p>Archivos adjuntados: {uploadReport.ok}.</p>
          )
        ) : null}
        <p className="small">Un asesor revisará su solicitud. Si creó una cuenta con este correo, puede seguirla en <Link href="/panel/solicitudes">Mi cuenta</Link>.</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : undefined;
  const err = (n: string) => (errors?.[n] ? { "aria-invalid": true as const, "aria-describedby": `${n}-error` } : {});

  return (
    <form action={action} className="form" noValidate={false}>
      <input type="hidden" name="kind" value={p.kind} />
      <input type="hidden" name="_t" value={started || ""} />
      {p.propertyId ? <input type="hidden" name="property_id" value={p.propertyId} /> : null}
      {p.propertyRef ? <input type="hidden" name="property_ref" value={p.propertyRef} /> : null}
      <div className="honeypot" aria-hidden="true">
        <label>
          No llenar este campo <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {p.children}

      <fieldset className="fieldset">
        <legend>Sus datos de contacto</legend>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor={`${p.kind}-name`} className="required">Nombre completo</label>
            <input id={`${p.kind}-name`} name="contact_name" className="input" required minLength={2} maxLength={160} autoComplete="name" defaultValue={p.defaultName} {...err("contact_name")} />
            <FieldError errors={errors} name="contact_name" />
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-phone`}>Teléfono / WhatsApp</label>
            <input id={`${p.kind}-phone`} name="contact_phone" className="input" inputMode="tel" autoComplete="tel" maxLength={25} placeholder="809-000-0000" {...err("contact_phone")} />
            <FieldError errors={errors} name="contact_phone" />
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-email`}>Correo electrónico</label>
            <input id={`${p.kind}-email`} name="contact_email" type="email" className="input" autoComplete="email" maxLength={160} defaultValue={p.defaultEmail} {...err("contact_email")} />
            <FieldError errors={errors} name="contact_email" />
          </div>
          <div className="field span-2">
            <span className="hint">Indique al menos un teléfono o un correo.</span>
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-channel`}>Canal preferido</label>
            <select id={`${p.kind}-channel`} name="preferred_channel" className="select" defaultValue="whatsapp">
              {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {!p.compact || p.messageLabel ? (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor={`${p.kind}-msg`} className={p.messageRequired ? "required" : undefined}>{p.messageLabel ?? "Mensaje"}</label>
            <textarea id={`${p.kind}-msg`} name="message" className="textarea" maxLength={4000} required={p.messageRequired} {...err("message")} />
            <FieldError errors={errors} name="message" />
          </div>
        ) : (
          <input type="hidden" name="message" value="" />
        )}
      </fieldset>

      {p.allowFiles ? (
        <div className="field">
          <label htmlFor={`${p.kind}-files`}>{p.filesLabel ?? "Fotos o documentos (opcional)"}</label>
          <input
            id={`${p.kind}-files`}
            type="file"
            multiple
            accept={DOC_TYPES.join(",")}
            className="input"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
          />
          <span className="hint">JPG, PNG, WebP o PDF. Hasta 10 archivos de 15 MB. Las fotos se comprimen y se les quitan los datos de ubicación. Los archivos son privados.</span>
        </div>
      ) : null}

      <div className="stack">
        <label className="check">
          <input type="checkbox" name="contact_consent" required {...err("contact_consent")} />
          <span>
            Autorizo a MAJ REALTY a contactarme para atender esta solicitud y a tratar mis datos según la <Link href="/legal/privacidad" target="_blank">política de privacidad</Link>.
          </span>
        </label>
        <FieldError errors={errors} name="contact_consent" />
        <label className="check">
          <input type="checkbox" name="marketing_consent" />
          <span>Deseo recibir información de nuevos inmuebles y servicios (opcional).</span>
        </label>
      </div>

      {env.turnstileSiteKey ? <Turnstile siteKey={env.turnstileSiteKey} /> : null}

      {state.status === "error" ? (
        <p className="alert alert-error" role="alert">{state.message}</p>
      ) : null}
      {!hasSupabase ? (
        <p className="alert alert-warning small">Modo demostración: este formulario no guarda datos todavía.</p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Enviando…" : p.submitLabel ?? "Enviar solicitud"}
      </button>
    </form>
  );
}
