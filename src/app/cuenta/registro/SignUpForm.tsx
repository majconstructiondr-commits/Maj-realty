"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { HumanFields } from "../HumanFields";

export function SignUpForm({ termsVersion }: { termsVersion: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signUp, idle);
  if (state.status === "ok") {
    return (
      <div className="alert alert-success" role="status">
        <p style={{ marginTop: 0 }}><strong>Revise su correo</strong></p>
        <p style={{ marginBottom: 0 }}>{state.message}</p>
      </div>
    );
  }
  const inv = (n: string) => (state.status === "error" && state.errors?.[n] ? { "aria-invalid": true as const, "aria-describedby": `${n}-error` } : {});
  return (
    <form action={action} className="form">
      <HumanFields />
      <div className="field">
        <label htmlFor="su-name" className="required">Nombre completo</label>
        <input id="su-name" name="full_name" className="input" autoComplete="name" required minLength={2} maxLength={160} {...inv("full_name")} />
        <ErrorText state={state} name="full_name" />
      </div>
      <div className="field">
        <label htmlFor="su-email" className="required">Correo electrónico</label>
        <input id="su-email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} {...inv("email")} />
        <ErrorText state={state} name="email" />
      </div>
      <div className="field">
        <label htmlFor="su-password" className="required">Contraseña</label>
        <input id="su-password" name="password" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} aria-describedby="su-password-hint" {...inv("password")} />
        <span className="hint" id="su-password-hint">Mínimo 10 caracteres. Use una frase fácil de recordar y difícil de adivinar.</span>
        <ErrorText state={state} name="password" />
      </div>
      <div className="field">
        <label htmlFor="su-password2" className="required">Repita la contraseña</label>
        <input id="su-password2" name="password_confirm" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} {...inv("password_confirm")} />
        <ErrorText state={state} name="password_confirm" />
      </div>
      <label className="check">
        <input type="checkbox" name="accept_terms" required {...inv("accept_terms")} />
        <span>
          He leído y acepto los <Link href="/legal/terminos" target="_blank">términos de uso</Link> y la{" "}
          <Link href="/legal/privacidad" target="_blank">política de privacidad</Link> (versión {termsVersion}).
        </span>
      </label>
      <ErrorText state={state} name="accept_terms" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}
