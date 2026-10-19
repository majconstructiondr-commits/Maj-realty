"use client";
import { useActionState, useEffect, useRef } from "react";
import { openTicket } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

export function TicketForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(openTicket, idle);
  const ref = useRef<HTMLFormElement>(null);
  const { d } = usePrivateI18n();
  const t = d.panel.managed;
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="form">
      <input type="hidden" name="contract_id" value={contractId} />
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="tk-title" className="required">{t.what}</label>
          <input id="tk-title" name="title" className="input" required minLength={3} maxLength={160} placeholder={t.whatPlaceholder} />
          <ErrorText state={state} name="title" />
        </div>
        <div className="field">
          <label htmlFor="tk-priority">{t.priority}</label>
          <select id="tk-priority" name="priority" className="select" defaultValue="normal">
            {Object.entries(d.status.ticketPriorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="tk-desc">{t.details}</label>
        <textarea id="tk-desc" name="description" className="textarea" maxLength={3000} />
        <ErrorText state={state} name="description" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{t.submitTicket}</SubmitButton>
    </form>
  );
}
