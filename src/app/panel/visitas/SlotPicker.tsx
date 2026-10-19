"use client";
import { useState } from "react";
import { timeSlots, weekdayOf, type BusinessHours } from "@/lib/panel/appointments";
import { fmt, usePrivateI18n } from "@/i18n/client";

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
  const t = usePrivateI18n().d.panel.slots;
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor={`${idPrefix}-date`} className="required">{t.date}</label>
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
        <label htmlFor={`${idPrefix}-time`} className="required">{t.time}</label>
        <select key={date} id={`${idPrefix}-time`} name="time" className="select" required disabled={!slots.length} aria-describedby={`${idPrefix}-time-hint`} defaultValue="">
          <option value="" disabled>{date ? (slots.length ? t.pickTime : t.noSlots) : t.pickDateFirst}</option>
          {slots.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="hint" id={`${idPrefix}-time-hint`}>
          {date && wd !== null && !slots.length ? fmt(t.closedDay, { day: t.weekdaysPlural[wd] }) : fmt(t.duration, { n: duration })}
        </span>
        {error ? <span className="error">{error}</span> : null}
      </div>
    </div>
  );
}
