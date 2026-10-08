"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../actions";
import { idle, type ActionState } from "@/lib/action-state";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signIn, idle);
  return (
    <form action={action} className="form">
      <input type="hidden" name="siguiente" value={next} />
      <div className="field">
        <label htmlFor="login-email" className="required">Correo electrónico</label>
        <input id="login-email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} />
      </div>
      <div className="field">
        <label htmlFor="login-password" className="required">Contraseña</label>
        <input id="login-password" name="password" type="password" className="input" autoComplete="current-password" required maxLength={200} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Ingresando…">Ingresar</SubmitButton>
      <p className="small">
        <Link href="/cuenta/recuperar">¿Olvidó su contraseña?</Link>
      </p>
    </form>
  );
}
