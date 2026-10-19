"use client";
import { useActionState } from "react";
import { createSavedSearch } from "./actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { fmt, usePrivateI18n } from "@/i18n/client";

export function SaveSearchForm({ path, summary, defaultName }: { path: string; summary: string; defaultName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createSavedSearch, idle);
  const t = usePrivateI18n().d.panel.searches;
  if (state.status === "ok") return <FormMessage state={state} />;
  return (
    <form action={action} className="form">
      <input type="hidden" name="path" value={path} />
      <p className="small" style={{ margin: 0 }}>{fmt(t.criteria, { summary })}</p>
      <div className="field">
        <label htmlFor="ss-name" className="required">{t.name}</label>
        <input id="ss-name" name="name" className="input" required maxLength={80} defaultValue={defaultName} />
        <ErrorText state={state} name="name" />
      </div>
      <label className="check">
        <input type="checkbox" name="notify" />
        <span>{t.notify}</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>{t.save}</SubmitButton>
    </form>
  );
}
