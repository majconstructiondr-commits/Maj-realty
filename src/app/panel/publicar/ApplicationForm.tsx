"use client";
import { startTransition, useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { CheckField, FieldErr, SelectField, TextAreaField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { submitApplication } from "./actions";

type Plan = { id: string; name: string; holder_type: "individual" | "organizacion"; priceLabel: string };

const TYPES = {
  propietario: { label: "Propietario", hint: "Publico mis propios inmuebles." },
  vendedor: { label: "Vendedor / agente independiente", hint: "Publico inmuebles de terceros con su autorización." },
  agencia: { label: "Agencia inmobiliaria", hint: "Varias personas publican a nombre de una empresa." },
} as const;

export function ApplicationForm({ userId, plans, termsVersion, defaultName }: { userId: string; plans: Plan[]; termsVersion: string; defaultName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitApplication, idle);
  const [type, setType] = useState<keyof typeof TYPES>("propietario");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const errors = state.status === "error" ? state.errors : undefined;
  const visiblePlans = plans.filter((p) => p.holder_type === (type === "agencia" ? "organizacion" : "individual"));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("id_doc");
    fd.delete("id_doc");
    if (file instanceof File && file.size > 0) {
      if (!DOC_TYPES.includes(file.type)) return setUploadError("El documento debe ser PDF, JPG, PNG o WebP.");
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
        if (body.size > MAX_DOC_BYTES) throw new Error("El archivo supera 15 MB.");
        const path = `profiles/${userId}/${safeFileName(name)}`;
        const up = await createClient().storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
        if (up.error) throw new Error("No se pudo subir el documento. Intente de nuevo o envíelo después.");
        fd.set("id_doc_path", path);
      } catch (err) {
        setUploading(false);
        return setUploadError((err as Error).message);
      }
      setUploading(false);
    }
    startTransition(() => action(fd));
  }

  if (state.status === "ok") {
    return <p className="alert alert-success" role="status">{state.message}</p>;
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <fieldset className="fieldset">
        <legend>¿Cómo va a publicar?</legend>
        <div className="grid" style={{ gap: 8 }} role="radiogroup" aria-describedby={errors?.applicant_type ? "applicant_type-error" : undefined}>
          {(Object.keys(TYPES) as (keyof typeof TYPES)[]).map((k) => (
            <label key={k} className="check">
              <input type="radio" name="applicant_type" value={k} checked={type === k} onChange={() => setType(k)} />
              <span><strong>{TYPES[k].label}</strong><span className="small muted" style={{ display: "block" }}>{TYPES[k].hint}</span></span>
            </label>
          ))}
        </div>
        <FieldErr errors={errors} name="applicant_type" />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Sus datos</legend>
        <div className="form-grid">
          <TextField name="full_name" label="Nombre completo" required maxLength={160} defaultValue={defaultName} errors={errors} autoComplete="name" />
          <TextField name="phone" label="Teléfono / WhatsApp" type="tel" maxLength={25} errors={errors} autoComplete="tel" placeholder="809-000-0000" />
        </div>
      </fieldset>

      {type === "agencia" ? (
        <fieldset className="fieldset">
          <legend>Datos de la agencia</legend>
          <div className="form-grid">
            <TextField name="org_name" label="Nombre comercial" required maxLength={160} errors={errors} />
            <TextField name="org_legal_name" label="Razón social" maxLength={200} errors={errors} />
            <TextField name="org_rnc" label="RNC" maxLength={20} errors={errors} hint="Privado: solo lo ven los gestores de la agencia y MAJ." />
            <TextField name="org_phone" label="Teléfono de la agencia" type="tel" maxLength={40} errors={errors} />
            <TextField className="span-2" name="org_email" label="Correo de la agencia" type="email" maxLength={160} errors={errors} />
          </div>
          <p className="xs muted" style={{ marginBottom: 0 }}>Usted quedará como gestor de la agencia. Podrá añadir miembros cuando MAJ la active.</p>
        </fieldset>
      ) : null}

      <fieldset className="fieldset">
        <legend>Plan y documentación</legend>
        <div className="form-grid">
          <SelectField key={type} className="span-2" name="requested_plan_id" label="Plan que le interesa" placeholder="Aún no sé / que MAJ me oriente" errors={errors}
            options={Object.fromEntries(visiblePlans.map((p) => [p.id, `${p.name} — ${p.priceLabel}`]))} />
          <div className="field span-2">
            <label htmlFor="f-id_doc">Documento de identidad (opcional)</label>
            <input id="f-id_doc" name="id_doc" type="file" className="input" accept="application/pdf,image/jpeg,image/png,image/webp" aria-describedby="id_doc-hint" />
            <span className="hint" id="id_doc-hint">Cédula, pasaporte o RNC. Se guarda en un archivo privado que solo ve el personal de MAJ. También puede enviarlo después si MAJ lo solicita.</span>
          </div>
          <TextAreaField className="span-2" name="notes" label="Comentarios para MAJ" maxLength={1500} rows={3} errors={errors}
            hint="Ej.: cuántos inmuebles piensa publicar, zonas, experiencia." />
        </div>
      </fieldset>

      <CheckField name="accept_terms" errors={errors} required
        label={<>Acepto las condiciones de publicación de MAJ REALTY (versión {termsVersion}) y entiendo que cada publicación será revisada antes de mostrarse.</>} />

      <div aria-live="polite">
        {uploadError ? <p className="alert alert-error" role="alert">{uploadError}</p> : null}
        <FormMessage state={state} />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || uploading} aria-busy={pending || uploading}>
          {uploading ? "Subiendo documento…" : pending ? "Enviando…" : "Enviar solicitud"}
        </button>
      </div>
    </form>
  );
}
