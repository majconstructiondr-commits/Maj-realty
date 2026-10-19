"use client";
import { useActionState } from "react";
import { startPropertyConversation } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

export function NewConversationForm({ propertyId, defaultSubject }: { propertyId: string; defaultSubject: string }) {
  const [state, action] = useActionState<ActionState, FormData>(startPropertyConversation, idle);
  const { d } = usePrivateI18n();
  const t = d.panel.newConversation;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="field">
        <label htmlFor="nc-subject" className="required">{t.subject}</label>
        <input id="nc-subject" name="subject" className="input" required minLength={2} maxLength={160} defaultValue={defaultSubject} />
        <ErrorText state={state} name="subject" />
      </div>
      <div className="field">
        <label htmlFor="nc-body" className="required">{t.message}</label>
        <textarea id="nc-body" name="body" className="textarea" required maxLength={4000} placeholder={t.placeholder} />
        <ErrorText state={state} name="body" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{t.send}</SubmitButton>
    </form>
  );
}
