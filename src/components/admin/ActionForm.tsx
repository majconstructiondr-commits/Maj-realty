"use client";
import { useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Formulario de acción de servidor del panel. Muestra el resultado confirmado por la base de datos
 * (nunca un éxito optimista), conserva lo escrito si hay errores y puede pedir confirmación.
 */
export function ActionForm({
  action, children, submit, pendingText, confirm, className = "form", buttonClass = "btn btn-primary",
  resetOnSuccess = false, inline = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submit: string;
  pendingText?: string;
  confirm?: string;
  className?: string;
  buttonClass?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
}) {
  const [state, setState] = useState<ActionState>(idle);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={inline ? "row" : className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await action(state, fd);
          setState(r);
          if (r.status === "ok" && resetOnSuccess) ref.current?.reset();
        });
      }}
    >
      {children}
      <button type="submit" className={buttonClass} disabled={pending} aria-busy={pending}>
        {pending ? pendingText ?? "Procesando…" : submit}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
