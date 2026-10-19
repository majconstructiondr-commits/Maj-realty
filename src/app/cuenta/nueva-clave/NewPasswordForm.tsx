"use client";
import { useActionState } from "react";
import Link from "next/link";
import { updatePassword } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

export function NewPasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(updatePassword, idle);
  const t = usePrivateI18n().d.account.newPassword;
  if (state.status === "ok") {
    return (
      <div className="stack">
        <FormMessage state={state} />
        <Link className="btn btn-primary" href="/panel">{t.goToAccount}</Link>
      </div>
    );
  }
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="np-password" className="required">{t.password}</label>
        <input id="np-password" name="password" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} aria-describedby="np-hint" />
        <span className="hint" id="np-hint">{t.hint}</span>
        <ErrorText state={state} name="password" />
      </div>
      <div className="field">
        <label htmlFor="np-password2" className="required">{t.repeat}</label>
        <input id="np-password2" name="password_confirm" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} />
        <ErrorText state={state} name="password_confirm" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t.submit}</SubmitButton>
    </form>
  );
}
