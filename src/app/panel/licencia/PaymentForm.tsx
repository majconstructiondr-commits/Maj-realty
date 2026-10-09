"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { SelectField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { submitPayment } from "./actions";

export function PaymentForm({ licenses }: { licenses: { id: string; label: string; currency: "DOP" | "USD" }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPayment, idle);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.status === "error" ? state.errors : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("receipt");
    fd.delete("receipt");
    const licenseId = String(fd.get("license_id") ?? "");
    if (file instanceof File && file.size > 0) {
      if (!DOC_TYPES.includes(file.type)) return setUploadError("El comprobante debe ser PDF, JPG, PNG o WebP.");
      if (!licenseId) return setUploadError("Seleccione la licencia antes de adjuntar el comprobante.");
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
        if (body.size > MAX_DOC_BYTES) throw new Error("El comprobante supera 15 MB.");
        const path = `licenses/${licenseId}/${safeFileName(name)}`;
        const up = await createClient().storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
        if (up.error) throw new Error("No se pudo subir el comprobante. Intente de nuevo.");
        fd.set("receipt_path", path);
      } catch (err) {
        setUploading(false);
        return setUploadError((err as Error).message);
      }
      setUploading(false);
    }
    startTransition(() => action(fd));
  }

  if (state.status === "ok") {
    return (
      <div className="alert alert-success" role="status">
        {state.message}
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>Registrar otro pago</button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate>
      <div className="form-grid">
        <SelectField className="span-2" name="license_id" label="Licencia" required errors={errors} placeholder="Seleccione…"
          options={Object.fromEntries(licenses.map((l) => [l.id, l.label]))} defaultValue={licenses.length === 1 ? licenses[0].id : ""} />
        <TextField name="amount" label="Monto pagado" required inputMode="decimal" errors={errors} placeholder="Ej.: 15000" />
        <SelectField name="currency" label="Moneda" required errors={errors} options={{ DOP: "Pesos dominicanos (RD$)", USD: "Dólares (US$)" }} defaultValue={licenses[0]?.currency ?? "DOP"} />
        <SelectField name="method" label="Método" required errors={errors} defaultValue="transferencia"
          options={{ transferencia: "Transferencia", deposito: "Depósito", efectivo: "Efectivo (en oficina)", otro: "Otro" }} />
        <TextField name="reference" label="Referencia o número de transacción" maxLength={120} errors={errors} />
        <div className="field span-2">
          <label htmlFor="f-receipt">Comprobante (PDF o imagen)</label>
          <input id="f-receipt" name="receipt" type="file" className="input" accept="application/pdf,image/jpeg,image/png,image/webp" aria-describedby="receipt-hint" />
          <span className="hint" id="receipt-hint">Se guarda en un archivo privado que solo ve el personal de MAJ y usted. Máximo 15 MB.</span>
        </div>
      </div>
      <div aria-live="polite">
        {uploadError ? <p className="alert alert-error" role="alert">{uploadError}</p> : null}
        <FormMessage state={state} />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || uploading} aria-busy={pending || uploading}>
          {uploading ? "Subiendo comprobante…" : pending ? "Registrando…" : "Registrar pago"}
        </button>
      </div>
      <p className="xs muted" style={{ margin: 0 }}>
        Registrar un pago no activa ni renueva la licencia: MAJ verifica el pago y luego actualiza la licencia.
      </p>
    </form>
  );
}
