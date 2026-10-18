"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitServiceRequest, type RequestState } from "@/app/actions/requests";
import { env, hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { formatDate } from "@/lib/format";
import { Turnstile } from "./Turnstile";
import { fmt, useI18n } from "@/i18n/client";

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
  const { d } = useI18n();
  const t = d.form;
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
        <h3 style={{ marginTop: 0 }}>{t.registered}</h3>
        <p>
          {t.trackingNumber} <strong>{state.number}</strong>
          <br />
          {t.date} {formatDate(state.createdAt, true)}
        </p>
        {uploading ? <p>{t.attaching}</p> : null}
        {uploadReport ? (
          uploadReport.failed.length ? (
            <p className="alert alert-warning">
              {fmt(t.attachPartial, { ok: uploadReport.ok, failed: uploadReport.failed.join(", ") })}
            </p>
          ) : (
            <p>{fmt(t.attached, { n: uploadReport.ok })}</p>
          )
        ) : null}
        <p className="small">{t.followUpBefore} <Link href="/panel/solicitudes">{t.followUpLink}</Link>.</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : undefined;
  // Errores de campos propios de cada formulario (p. ej. casillas), que no tienen mensaje junto al campo.
  const otherErrors = Object.entries(errors ?? {})
    .filter(([k]) => !["contact_name", "contact_phone", "contact_email", "message", "contact_consent"].includes(k))
    .map(([, m]) => m);
  const err = (n: string) => (errors?.[n] ? { "aria-invalid": true as const, "aria-describedby": `${n}-error` } : {});

  return (
    <form action={action} className="form" noValidate={false}>
      <input type="hidden" name="kind" value={p.kind} />
      <input type="hidden" name="_t" value={started || ""} />
      {p.propertyId ? <input type="hidden" name="property_id" value={p.propertyId} /> : null}
      {p.propertyRef ? <input type="hidden" name="property_ref" value={p.propertyRef} /> : null}
      <div className="honeypot" aria-hidden="true">
        <label>
          {t.honeypot} <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {p.children}

      <fieldset className="fieldset">
        <legend>{t.contactLegend}</legend>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor={`${p.kind}-name`} className="required">{t.name}</label>
            <input id={`${p.kind}-name`} name="contact_name" className="input" required minLength={2} maxLength={160} autoComplete="name" defaultValue={p.defaultName} {...err("contact_name")} />
            <FieldError errors={errors} name="contact_name" />
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-phone`}>{t.phone}</label>
            <input id={`${p.kind}-phone`} name="contact_phone" className="input" inputMode="tel" autoComplete="tel" maxLength={25} placeholder="809-000-0000" {...err("contact_phone")} />
            <FieldError errors={errors} name="contact_phone" />
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-email`}>{t.email}</label>
            <input id={`${p.kind}-email`} name="contact_email" type="email" className="input" autoComplete="email" maxLength={160} defaultValue={p.defaultEmail} {...err("contact_email")} />
            <FieldError errors={errors} name="contact_email" />
          </div>
          <div className="field span-2">
            <span className="hint">{t.phoneOrEmail}</span>
          </div>
          <div className="field">
            <label htmlFor={`${p.kind}-channel`}>{t.channel}</label>
            <select id={`${p.kind}-channel`} name="preferred_channel" className="select" defaultValue="whatsapp">
              {Object.entries(d.labels.channels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {!p.compact || p.messageLabel ? (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor={`${p.kind}-msg`} className={p.messageRequired ? "required" : undefined}>{p.messageLabel ?? t.message}</label>
            <textarea id={`${p.kind}-msg`} name="message" className="textarea" maxLength={4000} required={p.messageRequired} {...err("message")} />
            <FieldError errors={errors} name="message" />
          </div>
        ) : (
          <input type="hidden" name="message" value="" />
        )}
      </fieldset>

      {p.allowFiles ? (
        <div className="field">
          <label htmlFor={`${p.kind}-files`}>{p.filesLabel ?? t.filesDefault}</label>
          <input
            id={`${p.kind}-files`}
            type="file"
            multiple
            accept={DOC_TYPES.join(",")}
            className="input"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
          />
          <span className="hint">{t.filesHint}</span>
        </div>
      ) : null}

      <div className="stack">
        <label className="check">
          <input type="checkbox" name="contact_consent" required {...err("contact_consent")} />
          <span>
            {t.consentBefore} <Link href="/legal/privacidad" target="_blank">{t.consentLink}</Link>.
          </span>
        </label>
        <FieldError errors={errors} name="contact_consent" />
        <label className="check">
          <input type="checkbox" name="marketing_consent" />
          <span>{t.marketing}</span>
        </label>
      </div>

      {env.turnstileSiteKey ? <Turnstile siteKey={env.turnstileSiteKey} lang={t.turnstileLang} /> : null}

      {state.status === "error" ? (
        <div className="alert alert-error" role="alert">
          {state.message}
          {otherErrors.length ? <ul style={{ margin: "6px 0 0" }}>{otherErrors.map((m) => <li key={m}>{m}</li>)}</ul> : null}
        </div>
      ) : null}
      {!hasSupabase ? (
        <p className="alert alert-warning small">{t.demo}</p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? d.common.sending : p.submitLabel ?? t.submit}
      </button>
    </form>
  );
}
