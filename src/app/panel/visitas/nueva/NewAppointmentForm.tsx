"use client";
import { useActionState } from "react";
import { requestAppointment } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import type { BusinessHours } from "@/lib/panel/appointments";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { usePrivateI18n } from "@/i18n/client";
import { SlotPicker } from "../SlotPicker";

type Props = { propertyId: string; hours: BusinessHours; duration: number; minDate: string; maxDate: string };

export function NewAppointmentForm(p: Props) {
  const [state, action] = useActionState<ActionState, FormData>(requestAppointment, idle);
  const timeError = state.status === "error" ? state.errors?.time : undefined;
  const { d } = usePrivateI18n();
  const t = d.panel.newVisit;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={p.propertyId} />
      <SlotPicker hours={p.hours} duration={p.duration} minDate={p.minDate} maxDate={p.maxDate} idPrefix="nv" error={timeError} />
      <div className="field">
        <label htmlFor="nv-notes">{t.notes}</label>
        <textarea id="nv-notes" name="notes" className="textarea" maxLength={1000} rows={3} placeholder={t.notesPlaceholder} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText={d.common.sending}>{t.submit}</SubmitButton>
    </form>
  );
}
