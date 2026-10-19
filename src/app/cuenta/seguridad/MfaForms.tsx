"use client";
import { useActionState } from "react";
import { enrollTotp, removeFactor, verifyTotp, type EnrollState } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

export function VerifyForm({ factorId, next, submitLabel }: { factorId: string; next: string; submitLabel?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(verifyTotp, idle);
  const t = usePrivateI18n().d.account.security;
  return (
    <form action={action} className="form">
      <input type="hidden" name="factor_id" value={factorId} />
      <input type="hidden" name="siguiente" value={next} />
      <div className="field">
        <label htmlFor={`code-${factorId}`} className="required">{t.code}</label>
        <input
          id={`code-${factorId}`}
          name="code"
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          style={{ maxWidth: 200, letterSpacing: "0.2em" }}
          aria-describedby="code-hint"
        />
        <span className="hint" id="code-hint">{t.codeHint}</span>
        <ErrorText state={state} name="code" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={t.verifying}>{submitLabel ?? t.verify}</SubmitButton>
    </form>
  );
}

export function EnrollPanel({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EnrollState>(enrollTotp, { status: "idle" });
  const t = usePrivateI18n().d.account.security;
  if (state.status === "enrolled") {
    return (
      <div className="stack">
        <ol className="stack" style={{ paddingLeft: 20 }}>
          {t.enrollSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {state.qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generado por el servidor de autenticación
          <img src={state.qr} alt={t.qrAlt} width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
        ) : null}
        <p className="small">
          {t.manualKey} <code style={{ overflowWrap: "anywhere" }}>{state.secret}</code>
        </p>
        <VerifyForm factorId={state.factorId} next={next} submitLabel={t.activate} />
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      {state.status === "error" ? <p className="alert alert-error" role="alert">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? t.preparing : t.setup}
      </button>
    </form>
  );
}

export function RemoveFactorForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(removeFactor, idle);
  const t = usePrivateI18n().d.account.security;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="factor_id" value={factorId} />
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>{t.removeConfirm}</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-danger btn-sm" pendingText={t.removing}>{t.remove}</SubmitButton>
    </form>
  );
}
