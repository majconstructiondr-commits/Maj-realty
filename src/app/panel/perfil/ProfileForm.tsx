"use client";
import { useActionState } from "react";
import { updateProfile } from "./actions";
import { idle, type ActionState } from "@/lib/action-state";
import { ErrorText, FormMessage, SubmitButton } from "@/components/forms/FormBits";

type Props = { fullName: string; displayName: string; phone: string; whatsapp: string; marketing: boolean };

export function ProfileForm(p: Props) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfile, idle);
  const inv = (n: string) => (state.status === "error" && state.errors?.[n] ? { "aria-invalid": true as const, "aria-describedby": `${n}-error` } : {});
  return (
    <form action={action} className="form">
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="pf-name" className="required">Nombre completo</label>
          <input id="pf-name" name="full_name" className="input" required minLength={2} maxLength={160} autoComplete="name" defaultValue={p.fullName} {...inv("full_name")} />
          <ErrorText state={state} name="full_name" />
        </div>
        <div className="field span-2">
          <label htmlFor="pf-display">Nombre visible en el chat (opcional)</label>
          <input id="pf-display" name="display_name" className="input" maxLength={80} defaultValue={p.displayName} aria-describedby="pf-display-hint" {...inv("display_name")} />
          <span className="hint" id="pf-display-hint">Si lo deja vacío, se mostrará su primer nombre.</span>
          <ErrorText state={state} name="display_name" />
        </div>
        <div className="field">
          <label htmlFor="pf-phone">Teléfono</label>
          <input id="pf-phone" name="phone" className="input" inputMode="tel" autoComplete="tel" maxLength={25} defaultValue={p.phone} {...inv("phone")} />
          <ErrorText state={state} name="phone" />
        </div>
        <div className="field">
          <label htmlFor="pf-wa">WhatsApp</label>
          <input id="pf-wa" name="whatsapp" className="input" inputMode="tel" maxLength={25} defaultValue={p.whatsapp} {...inv("whatsapp")} />
          <ErrorText state={state} name="whatsapp" />
        </div>
      </div>
      <p className="xs muted">Su teléfono y WhatsApp son privados: solo los ve el equipo de MAJ.</p>
      <label className="check">
        <input type="checkbox" name="marketing_opt_in" defaultChecked={p.marketing} />
        <span>Deseo recibir información de nuevos inmuebles y servicios de MAJ REALTY. Puede desactivarlo cuando quiera.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Guardar cambios</SubmitButton>
    </form>
  );
}
