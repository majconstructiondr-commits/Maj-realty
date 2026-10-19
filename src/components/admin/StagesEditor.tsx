"use client";
import { useState } from "react";
import { fmt, usePrivateI18n } from "@/i18n/client";

export type QuoteStage = { name: string; description?: string; duration?: string; percent?: number };

/** Editor de etapas de una cotización. Envía la lista como JSON en el campo oculto "stages". */
export function StagesEditor({ initial, disabled = false }: { initial: QuoteStage[]; disabled?: boolean }) {
  const [stages, setStages] = useState<QuoteStage[]>(initial);
  const t = usePrivateI18n().d.admin.quoteForm;
  const set = (i: number, patch: Partial<QuoteStage>) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setStages((s) => {
      const j = i + d;
      if (j < 0 || j >= s.length) return s;
      const c = [...s];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  return (
    <fieldset className="fieldset" disabled={disabled}>
      <legend>{t.stages}</legend>
      <input type="hidden" name="stages" value={JSON.stringify(stages.filter((s) => s.name.trim()))} />
      {stages.length === 0 && <p className="small muted">{t.noStages}</p>}
      {stages.map((s, i) => (
        <div key={i} className="form-grid" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
          <div className="field"><label htmlFor={`st-n-${i}`}>{fmt(t.stage, { n: i + 1 })}</label><input id={`st-n-${i}`} className="input" value={s.name} maxLength={160} onChange={(e) => set(i, { name: e.target.value })} /></div>
          <div className="field"><label htmlFor={`st-d-${i}`}>{t.duration}</label><input id={`st-d-${i}`} className="input" value={s.duration ?? ""} maxLength={60} placeholder={t.durationPlaceholder} onChange={(e) => set(i, { duration: e.target.value || undefined })} /></div>
          <div className="field"><label htmlFor={`st-p-${i}`}>{t.percent}</label><input id={`st-p-${i}`} className="input" type="number" min={0} max={100} step="0.01" value={s.percent ?? ""} onChange={(e) => set(i, { percent: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
          <div className="field"><label htmlFor={`st-x-${i}`}>{t.description}</label><input id={`st-x-${i}`} className="input" value={s.description ?? ""} maxLength={600} onChange={(e) => set(i, { description: e.target.value || undefined })} /></div>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} aria-label={fmt(t.moveUp, { n: i + 1 })}>↑</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} aria-label={fmt(t.moveDown, { n: i + 1 })}>↓</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStages((x) => x.filter((_, j) => j !== i))}>{t.remove}</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStages((s) => [...s, { name: "" }])} disabled={stages.length >= 30}>{t.addStage}</button>
    </fieldset>
  );
}
