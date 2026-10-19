"use client";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";
import { HumanFields } from "../HumanFields";

export function ResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, idle);
  const { d } = usePrivateI18n();
  const t = d.account.reset;
  if (state.status === "ok") return <FormMessage state={state} />;
  return (
    <form action={action} className="form">
      <HumanFields />
      <div className="field">
        <label htmlFor="rc-email" className="required">{t.email}</label>
        <input id="rc-email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} />
        <ErrorText state={state} name="email" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{t.submit}</SubmitButton>
    </form>
  );
}
