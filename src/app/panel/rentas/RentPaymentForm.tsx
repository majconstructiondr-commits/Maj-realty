"use client";
import { startTransition, useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { SelectField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { compressImage, DOC_TYPES, IMAGE_TYPES, MAX_DOC_BYTES, safeFileName } from "@/lib/upload";
import { fmt, usePrivateI18n } from "@/i18n/client";
import { submitRentPayment } from "./actions";

export function RentPaymentForm({ chargeId, amount, currency }: { chargeId: string; amount: number; currency: "DOP" | "USD" }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitRentPayment, idle);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.status === "error" ? state.errors : undefined;
  const { d } = usePrivateI18n();
  const t = d.panel.payment;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("receipt");
    fd.delete("receipt");
    if (file instanceof File && file.size > 0) {
      if (!DOC_TYPES.includes(file.type)) return setUploadError(t.receiptType);
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
        if (body.size > MAX_DOC_BYTES) throw new Error(t.receiptTooLarge);
        const path = `rent/${chargeId}/${safeFileName(name)}`;
        const up = await createClient().storage.from("private-docs").upload(path, body, { contentType: mime, upsert: false });
        if (up.error) throw new Error(t.receiptUploadFailed);
        fd.set("receipt_path", path);
      } catch (err) {
        setUploading(false);
        return setUploadError((err as Error).message);
      }
      setUploading(false);
    }
    startTransition(() => action(fd));
  }

  if (state.status === "ok") return <p className="alert alert-success" role="status">{state.message}</p>;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="charge_id" value={chargeId} />
      <input type="hidden" name="currency" value={currency} />
      <div className="form-grid">
        <TextField id={`amt-${chargeId}`} name="amount" label={fmt(t.amountCurrency, { currency })} required inputMode="decimal" errors={errors} defaultValue={amount} />
        <SelectField id={`met-${chargeId}`} name="method" label={t.method} required errors={errors} defaultValue="transferencia"
          options={t.methods} />
        <TextField id={`ref-${chargeId}`} name="reference" label={t.reference} maxLength={120} errors={errors} className="span-2" />
        <div className="field span-2">
          <label htmlFor={`rc-${chargeId}`}>{t.receiptPhoto}</label>
          <input id={`rc-${chargeId}`} name="receipt" type="file" className="input" accept="application/pdf,image/jpeg,image/png,image/webp" />
          <span className="hint">{t.receiptHintRent}</span>
        </div>
      </div>
      <div aria-live="polite">
        {uploadError ? <p className="alert alert-error" role="alert">{uploadError}</p> : null}
        <FormMessage state={state} />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || uploading} aria-busy={pending || uploading}>
          {uploading ? t.uploading : pending ? d.common.sending : t.report}
        </button>
      </div>
    </form>
  );
}
