"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { HumanFields } from "../HumanFields";

export function ResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, idle);
  if (state.status === "ok") return <FormMessage state={state} />;
  return (
    <form action={action} className="form">
      <HumanFields />
      <div className="field">
        <label htmlFor="rc-email" className="required">Correo electrónico de su cuenta</label>
        <input id="rc-email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} />
        <ErrorText state={state} name="email" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
