"use client";
import { useActionState } from "react";
import { submitForReview } from "@/app/panel/publicaciones/editor-actions";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { usePrivateI18n } from "@/i18n/client";
import { CheckField } from "./fields";

export function SubmitReview({ propertyId, disabled, label }: { propertyId: string; disabled?: boolean; label: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitForReview, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  const { d } = usePrivateI18n();
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <CheckField
        name="confirm"
        errors={errors}
        required
        label={d.editor.submit.confirm}
      />
      <FormMessage state={state} />
      <div>
        {disabled ? (
          <button type="button" className="btn btn-primary" disabled aria-disabled="true">{label}</button>
        ) : (
          <SubmitButton pendingText={d.common.sending}>{label}</SubmitButton>
        )}
      </div>
      <p className="xs muted" style={{ margin: 0 }}>
        {d.editor.submit.note}
      </p>
    </form>
  );
}
