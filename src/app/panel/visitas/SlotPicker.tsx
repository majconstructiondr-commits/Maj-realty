"use client";
import { useState } from "react";
import { timeSlots, WEEKDAYS, weekdayOf, type BusinessHours } from "@/lib/panel/appointments";

type Props = {
  hours: BusinessHours;
  duration: number;
  minDate: string;
  maxDate: string;
  idPrefix: string;
  error?: string;
};

/** Selector de fecha y hora (hora de Santo Domingo) limitado al horario de atención configurado. */
export function SlotPicker({ hours, duration, minDate, maxDate, idPrefix, error }: Props) {
  const [date, setDate] = useState("");
  const slots = date ? timeSlots(hours, date, duration) : [];
  const wd = date ? weekdayOf(date) : null;
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor={`${idPrefix}-date`} className="required">Fecha</label>
        <input
          id={`${idPrefix}-date`}
          name="date"
          type="date"
          className="input"
          required
          min={minDate}
          max={maxDate}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-time`} className="required">Hora (Santo Domingo)</label>
        <select key={date} id={`${idPrefix}-time`} name="time" className="select" required disabled={!slots.length} aria-describedby={`${idPrefix}-time-hint`} defaultValue="">
          <option value="" disabled>{date ? (slots.length ? "Elija una hora" : "Sin horario este día") : "Elija primero la fecha"}</option>
          {slots.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="hint" id={`${idPrefix}-time-hint`}>
          {date && wd !== null && !slots.length ? `No atendemos los ${WEEKDAYS[wd]}. Elija otra fecha.` : `Duración aproximada: ${duration} minutos.`}
        </span>
        {error ? <span className="error">{error}</span> : null}
      </div>
    </div>
  );
}
