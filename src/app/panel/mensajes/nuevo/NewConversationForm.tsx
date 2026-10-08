"use client";
import { useActionState } from "react";
import { startPropertyConversation } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";

export function NewConversationForm({ propertyId, defaultSubject }: { propertyId: string; defaultSubject: string }) {
  const [state, action] = useActionState<ActionState, FormData>(startPropertyConversation, idle);
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="field">
        <label htmlFor="nc-subject" className="required">Asunto</label>
        <input id="nc-subject" name="subject" className="input" required minLength={2} maxLength={160} defaultValue={defaultSubject} />
        <ErrorText state={state} name="subject" />
      </div>
      <div className="field">
        <label htmlFor="nc-body" className="required">Mensaje</label>
        <textarea id="nc-body" name="body" className="textarea" required maxLength={4000} placeholder="¿Qué le gustaría saber del inmueble?" />
        <ErrorText state={state} name="body" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Enviando…">Enviar mensaje</SubmitButton>
    </form>
  );
}
