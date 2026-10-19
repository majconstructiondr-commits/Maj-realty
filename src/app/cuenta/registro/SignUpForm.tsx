"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { fmt, usePrivateI18n } from "@/i18n/client";
import { HumanFields } from "../HumanFields";

export function SignUpForm({ termsVersion }: { termsVersion: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signUp, idle);
  const t = usePrivateI18n().d.account.signup;
  if (state.status === "ok") {
    return (
      <div className="alert alert-success" role="status">
        <p style={{ marginTop: 0 }}><strong>{t.checkEmail}</strong></p>
        <p style={{ marginBottom: 0 }}>{state.message}</p>
      </div>
    );
  }
  const inv = (n: string) => (state.status === "error" && state.errors?.[n] ? { "aria-invalid": true as const, "aria-describedby": `${n}-error` } : {});
  return (
    <form action={action} className="form">
      <HumanFields />
      <div className="field">
        <label htmlFor="su-name" className="required">{t.fullName}</label>
        <input id="su-name" name="full_name" className="input" autoComplete="name" required minLength={2} maxLength={160} {...inv("full_name")} />
        <ErrorText state={state} name="full_name" />
      </div>
      <div className="field">
        <label htmlFor="su-email" className="required">{t.email}</label>
        <input id="su-email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} {...inv("email")} />
        <ErrorText state={state} name="email" />
      </div>
      <div className="field">
        <label htmlFor="su-password" className="required">{t.password}</label>
        <input id="su-password" name="password" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} aria-describedby="su-password-hint" {...inv("password")} />
        <span className="hint" id="su-password-hint">{t.passwordHint}</span>
        <ErrorText state={state} name="password" />
      </div>
      <div className="field">
        <label htmlFor="su-password2" className="required">{t.repeatPassword}</label>
        <input id="su-password2" name="password_confirm" type="password" className="input" autoComplete="new-password" required minLength={10} maxLength={72} {...inv("password_confirm")} />
        <ErrorText state={state} name="password_confirm" />
      </div>
      <label className="check">
        <input type="checkbox" name="accept_terms" required {...inv("accept_terms")} />
        <span>
          {t.acceptBefore} <Link href="/legal/terminos" target="_blank">{t.terms}</Link> {t.and}{" "}
          <Link href="/legal/privacidad" target="_blank">{t.privacy}</Link> {fmt(t.version, { v: termsVersion })}
        </span>
      </label>
      <ErrorText state={state} name="accept_terms" />
      <FormMessage state={state} />
      <SubmitButton pendingText={t.submitting}>{t.submit}</SubmitButton>
    </form>
  );
}
