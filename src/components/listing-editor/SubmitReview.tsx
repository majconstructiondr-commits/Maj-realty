"use client";
import { useActionState } from "react";
import { submitForReview } from "@/app/panel/publicaciones/editor-actions";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { CheckField } from "./fields";

export function SubmitReview({ propertyId, disabled, label }: { propertyId: string; disabled?: boolean; label: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitForReview, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <CheckField
        name="confirm"
        errors={errors}
        required
        label="Confirmo que la información es veraz, que las fotos son del inmueble y que cuento con la autorización del propietario para publicarlo."
      />
      <FormMessage state={state} />
      <div>
        {disabled ? (
          <button type="button" className="btn btn-primary" disabled aria-disabled="true">{label}</button>
        ) : (
          <SubmitButton pendingText="Enviando…">{label}</SubmitButton>
        )}
      </div>
      <p className="xs muted" style={{ margin: 0 }}>
        MAJ revisa cada publicación antes de mostrarla. Enviar a revisión usa un cupo de su licencia mientras esté en revisión, publicada o reservada.
      </p>
    </form>
  );
}
