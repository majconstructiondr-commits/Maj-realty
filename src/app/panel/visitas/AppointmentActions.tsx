"use client";
import { useActionState, useState } from "react";
import { updateAppointment } from "./actions";
import { idle, type ActionState } from "@/lib/action-state";
import type { BusinessHours } from "@/lib/panel/appointments";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { SlotPicker } from "./SlotPicker";

type Props = {
  id: string;
  status: string;
  isAgent: boolean;
  isClient: boolean;
  past: boolean;
  hours: BusinessHours;
  duration: number;
  minDate: string;
  maxDate: string;
};

export function AppointmentActions(p: Props) {
  const [mode, setMode] = useState<"" | "cancelar" | "reprogramar">("");
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await updateAppointment(prev, fd);
    if (r.status === "ok") setMode("");
    return r;
  }, idle);
  const active = p.status === "solicitada" || p.status === "confirmada";
  const canConfirm = p.isAgent && p.status === "solicitada";
  const canComplete = p.isAgent && p.status === "confirmada";
  if (!active && state.status === "idle") return null;

  return (
    <div className="stack">
      <FormMessage state={state} />
      {active ? (
        <div className="row" style={{ gap: 6 }}>
          {canConfirm ? (
            <form action={action}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="action" value="confirmar" />
              <SubmitButton className="btn btn-primary btn-sm" pendingText="Confirmando…">Confirmar</SubmitButton>
            </form>
          ) : null}
          {canComplete ? (
            <>
              <form action={action}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="action" value="completar" />
                <SubmitButton className="btn btn-outline btn-sm" pendingText="Guardando…">Marcar completada</SubmitButton>
              </form>
              <form action={action}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="action" value="no_asistio" />
                <SubmitButton className="btn btn-ghost btn-sm" pendingText="Guardando…">No asistió</SubmitButton>
              </form>
            </>
          ) : null}
          {!p.past ? (
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={mode === "reprogramar"} onClick={() => setMode(mode === "reprogramar" ? "" : "reprogramar")}>
              Reprogramar
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={mode === "cancelar"} onClick={() => setMode(mode === "cancelar" ? "" : "cancelar")}>
            Cancelar visita
          </button>
        </div>
      ) : null}
      {active && mode === "reprogramar" ? (
        <form action={action} className="form box">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="action" value="reprogramar" />
          <SlotPicker hours={p.hours} duration={p.duration} minDate={p.minDate} maxDate={p.maxDate} idPrefix={`re-${p.id}`} />
          {!p.isAgent ? <p className="xs muted">El asesor deberá confirmar el nuevo horario.</p> : null}
          <SubmitButton className="btn btn-primary btn-sm" pendingText="Guardando…">Guardar nuevo horario</SubmitButton>
        </form>
      ) : null}
      {active && mode === "cancelar" ? (
        <form action={action} className="form box">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="action" value="cancelar" />
          <div className="field">
            <label htmlFor={`cancel-${p.id}`} className="required">Motivo de la cancelación</label>
            <textarea id={`cancel-${p.id}`} name="reason" className="textarea" required maxLength={500} rows={2} />
          </div>
          <SubmitButton className="btn btn-danger btn-sm" pendingText="Cancelando…">Confirmar cancelación</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
