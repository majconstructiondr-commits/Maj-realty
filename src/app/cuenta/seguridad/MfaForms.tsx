"use client";
import { useActionState } from "react";
import { enrollTotp, removeFactor, verifyTotp, type EnrollState } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";

export function VerifyForm({ factorId, next, submitLabel = "Verificar código" }: { factorId: string; next: string; submitLabel?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(verifyTotp, idle);
  return (
    <form action={action} className="form">
      <input type="hidden" name="factor_id" value={factorId} />
      <input type="hidden" name="siguiente" value={next} />
      <div className="field">
        <label htmlFor={`code-${factorId}`} className="required">Código de 6 dígitos</label>
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
        <span className="hint" id="code-hint">Ábralo en su aplicación de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</span>
        <ErrorText state={state} name="code" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Verificando…">{submitLabel}</SubmitButton>
    </form>
  );
}

export function EnrollPanel({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EnrollState>(enrollTotp, { status: "idle" });
  if (state.status === "enrolled") {
    return (
      <div className="stack">
        <ol className="stack" style={{ paddingLeft: 20 }}>
          <li>Escanee este código QR con su aplicación de autenticación.</li>
          <li>Si no puede escanearlo, escriba manualmente la clave que aparece debajo.</li>
          <li>Introduzca el código de 6 dígitos que muestra la aplicación.</li>
        </ol>
        {state.qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL generado por el servidor de autenticación
          <img src={state.qr} alt="Código QR para configurar el autenticador" width={200} height={200} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
        ) : null}
        <p className="small">
          Clave manual: <code style={{ overflowWrap: "anywhere" }}>{state.secret}</code>
        </p>
        <VerifyForm factorId={state.factorId} next={next} submitLabel="Activar segundo factor" />
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      {state.status === "error" ? <p className="alert alert-error" role="alert">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? "Preparando…" : "Configurar aplicación de autenticación"}
      </button>
    </form>
  );
}

export function RemoveFactorForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(removeFactor, idle);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="factor_id" value={factorId} />
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>Entiendo que mi cuenta quedará protegida solo con contraseña.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-danger btn-sm" pendingText="Eliminando…">Eliminar este factor</SubmitButton>
    </form>
  );
}
