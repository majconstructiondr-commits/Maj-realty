"use client";
import { useActionState, useState } from "react";
import { respondQuote } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";

/** Se mantiene montado tras responder para conservar el mensaje con el estado devuelto por la base de datos. */
export function RespondForm({ quoteId, pending }: { quoteId: string; pending: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(respondQuote, idle);
  const [decision, setDecision] = useState<"aceptar" | "rechazar">("aceptar");
  const { d } = usePrivateI18n();
  const t = d.panel.quote;
  if (state.status === "ok" || (!pending && state.status === "error")) return <FormMessage state={state} />;
  if (!pending) return null;
  return (
    <form action={action} className="form">
      <input type="hidden" name="quote_id" value={quoteId} />
      <fieldset className="fieldset">
        <legend>{t.yourResponse}</legend>
        <div className="chip-group">
          <label className="chip">
            <input type="radio" name="decision" value="aceptar" checked={decision === "aceptar"} onChange={() => setDecision("aceptar")} /> {t.accept}
          </label>
          <label className="chip">
            <input type="radio" name="decision" value="rechazar" checked={decision === "rechazar"} onChange={() => setDecision("rechazar")} /> {t.reject}
          </label>
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="q-comment">{t.comment}</label>
        <textarea id="q-comment" name="comment" className="textarea" maxLength={2000} />
      </div>
      {decision === "aceptar" ? (
        <label className="check">
          <input type="checkbox" name="confirm" required />
          <span>{t.confirmRead}</span>
        </label>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{decision === "aceptar" ? t.acceptQuote : t.rejectQuote}</SubmitButton>
    </form>
  );
}
