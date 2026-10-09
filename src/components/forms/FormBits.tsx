"use client";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({ children, pendingText = "Guardando…", className = "btn btn-primary" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "ok") return <p className="alert alert-success" role="status">{state.message}</p>;
  if (state.status === "error") return <p className="alert alert-error" role="alert">{state.message}</p>;
  return null;
}

export function ErrorText({ state, name }: { state: ActionState; name: string }) {
  if (state.status !== "error" || !state.errors?.[name]) return null;
  return <span className="error" id={`${name}-error`}>{state.errors[name]}</span>;
}
