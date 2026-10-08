"use client";
// Formulario de un paso del editor. Se envía con transición manual para no reiniciar los campos
// si el servidor devuelve errores (el usuario no pierde lo escrito).
import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { saveStep } from "@/app/panel/publicaciones/editor-actions";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import type { Errors } from "./fields";

export function EditorForm({
  propertyId, step, live, isLast, children,
}: {
  propertyId: string;
  step: number;
  live: boolean;
  isLast?: boolean;
  children: (errors: Errors) => ReactNode;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveStep, idle);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") msgRef.current?.focus();
  }, [state]);
  const errors = state.status === "error" ? state.errors : undefined;
  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="step" value={step} />
      {children(errors)}
      <div ref={msgRef} tabIndex={-1} aria-live="polite" style={{ outline: "none" }}>
        <FormMessage state={state} />
        {errors && Object.keys(errors).length ? (
          <ul className="small" style={{ color: "var(--danger)", margin: "8px 0 0" }}>
            {Object.entries(errors).slice(0, 8).map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="row le-actions">
        <button type="submit" className="btn btn-ghost" disabled={pending} aria-busy={pending}>
          {pending ? "Guardando…" : live ? "Enviar cambios a revisión" : "Guardar borrador"}
        </button>
        {!isLast ? (
          <button type="submit" name="_continuar" value="1" className="btn btn-primary" disabled={pending}>
            {live ? "Enviar cambios y continuar" : "Guardar y continuar"}
          </button>
        ) : null}
      </div>
      {live ? (
        <p className="xs muted" style={{ margin: 0 }}>
          Esta publicación ya está activa: sus cambios se envían como solicitud y la versión publicada se mantiene hasta que MAJ los apruebe.
        </p>
      ) : null}
    </form>
  );
}
