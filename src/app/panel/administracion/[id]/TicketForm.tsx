"use client";
import { useActionState, useEffect, useRef } from "react";
import { openTicket } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { TICKET_PRIORITIES } from "@/lib/panel/labels";

export function TicketForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(openTicket, idle);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="form">
      <input type="hidden" name="contract_id" value={contractId} />
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="tk-title" className="required">¿Qué ocurre?</label>
          <input id="tk-title" name="title" className="input" required minLength={3} maxLength={160} placeholder="Ej.: filtración en el baño del apto 2B" />
          <ErrorText state={state} name="title" />
        </div>
        <div className="field">
          <label htmlFor="tk-priority">Prioridad</label>
          <select id="tk-priority" name="priority" className="select" defaultValue="normal">
            {Object.entries(TICKET_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="tk-desc">Detalles (opcional)</label>
        <textarea id="tk-desc" name="description" className="textarea" maxLength={3000} />
        <ErrorText state={state} name="description" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Enviando…">Reportar mantenimiento</SubmitButton>
    </form>
  );
}
