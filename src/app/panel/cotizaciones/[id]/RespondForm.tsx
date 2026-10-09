"use client";
import { useActionState, useState } from "react";
import { respondQuote } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";

/** Se mantiene montado tras responder para conservar el mensaje con el estado devuelto por la base de datos. */
export function RespondForm({ quoteId, pending }: { quoteId: string; pending: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(respondQuote, idle);
  const [decision, setDecision] = useState<"aceptar" | "rechazar">("aceptar");
  if (state.status === "ok" || (!pending && state.status === "error")) return <FormMessage state={state} />;
  if (!pending) return null;
  return (
    <form action={action} className="form">
      <input type="hidden" name="quote_id" value={quoteId} />
      <fieldset className="fieldset">
        <legend>Su respuesta</legend>
        <div className="chip-group">
          <label className="chip">
            <input type="radio" name="decision" value="aceptar" checked={decision === "aceptar"} onChange={() => setDecision("aceptar")} /> Aceptar
          </label>
          <label className="chip">
            <input type="radio" name="decision" value="rechazar" checked={decision === "rechazar"} onChange={() => setDecision("rechazar")} /> Rechazar
          </label>
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="q-comment">Comentario (opcional)</label>
        <textarea id="q-comment" name="comment" className="textarea" maxLength={2000} />
      </div>
      {decision === "aceptar" ? (
        <label className="check">
          <input type="checkbox" name="confirm" required />
          <span>Leí el alcance, las exclusiones y las condiciones de esta cotización.</span>
        </label>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingText="Enviando…">{decision === "aceptar" ? "Aceptar cotización" : "Rechazar cotización"}</SubmitButton>
    </form>
  );
}
