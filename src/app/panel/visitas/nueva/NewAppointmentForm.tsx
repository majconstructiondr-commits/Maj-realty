"use client";
import { useActionState } from "react";
import { requestAppointment } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import type { BusinessHours } from "@/lib/panel/appointments";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { SlotPicker } from "../SlotPicker";

type Props = { propertyId: string; hours: BusinessHours; duration: number; minDate: string; maxDate: string };

export function NewAppointmentForm(p: Props) {
  const [state, action] = useActionState<ActionState, FormData>(requestAppointment, idle);
  const timeError = state.status === "error" ? state.errors?.time : undefined;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={p.propertyId} />
      <SlotPicker hours={p.hours} duration={p.duration} minDate={p.minDate} maxDate={p.maxDate} idPrefix="nv" error={timeError} />
      <div className="field">
        <label htmlFor="nv-notes">Notas para el asesor (opcional)</label>
        <textarea id="nv-notes" name="notes" className="textarea" maxLength={1000} rows={3} placeholder="Ej.: vendré con mi familia; prefiero que me llamen antes." />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Enviando…">Solicitar visita</SubmitButton>
    </form>
  );
}
