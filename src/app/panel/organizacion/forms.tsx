"use client";
import { startTransition, useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { CheckField, SelectField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { addMember, removeMember, updateMember, updateOrganization } from "./actions";

type Org = { id: string; name: string; legal_name: string | null; rnc: string | null; phone: string | null; email: string | null };
export type MemberRow = {
  user_id: string; full_name: string; email: string | null; member_role: "gestor" | "agente"; can_publish: boolean;
  can_view_all_listings: boolean; can_manage_members: boolean; can_view_leads: boolean; created_at: string;
};

const ROLES = { agente: "Agente", gestor: "Gestor (administra la agencia)" };

/** Envío sin reinicio del formulario para conservar lo escrito si hay errores. */
function submitWith(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

export function OrgDetailsForm({ org }: { org: Org }) {
  const [state, action] = useActionState<ActionState, FormData>(updateOrganization, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  return (
    <form className="form" onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="org_id" value={org.id} />
      <div className="form-grid">
        <TextField name="name" label="Nombre comercial" required maxLength={160} defaultValue={org.name} errors={errors} />
        <TextField name="legal_name" label="Razón social" maxLength={200} defaultValue={org.legal_name} errors={errors} />
        <TextField name="rnc" label="RNC (privado)" maxLength={20} defaultValue={org.rnc} errors={errors} />
        <TextField name="phone" label="Teléfono" type="tel" maxLength={40} defaultValue={org.phone} errors={errors} />
        <TextField className="span-2" name="email" label="Correo" type="email" maxLength={160} defaultValue={org.email} errors={errors} />
      </div>
      <FormMessage state={state} />
      <div><SubmitButton>Guardar datos</SubmitButton></div>
    </form>
  );
}

function PermFields({ prefix, m, errors }: { prefix: string; m?: Partial<MemberRow>; errors?: Record<string, string> }) {
  return (
    <div className="form-grid">
      <SelectField id={`${prefix}-role`} name="member_role" label="Rol" options={ROLES} defaultValue={m?.member_role ?? "agente"} errors={errors} />
      <div className="field">
        <span className="label">Permisos</span>
        <CheckField id={`${prefix}-pub`} name="can_publish" label="Puede publicar a nombre de la agencia" defaultChecked={m?.can_publish ?? true} />
        <CheckField id={`${prefix}-all`} name="can_view_all_listings" label="Ve todas las publicaciones de la agencia" defaultChecked={m?.can_view_all_listings ?? false} />
        <CheckField id={`${prefix}-mng`} name="can_manage_members" label="Gestiona miembros (y edita publicaciones de la agencia)" defaultChecked={m?.can_manage_members ?? false} />
        <CheckField id={`${prefix}-leads`} name="can_view_leads" label="Ve los interesados asignados a la agencia" defaultChecked={m?.can_view_leads ?? false} />
      </div>
    </div>
  );
}

export function AddMemberForm({ orgId, disabledReason }: { orgId: string; disabledReason?: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(addMember, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  if (disabledReason) return <p className="alert alert-info small">{disabledReason}</p>;
  return (
    <form className="form" onSubmit={submitWith(action)} noValidate>
      <input type="hidden" name="org_id" value={orgId} />
      <TextField id="new-member-email" name="email" type="email" label="Correo de la persona" required maxLength={160} errors={errors}
        hint="Debe tener una cuenta registrada en MAJ con ese correo." autoComplete="off" />
      <PermFields prefix="new" errors={errors} />
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Añadiendo…">Añadir miembro</SubmitButton></div>
      <p className="xs muted" style={{ margin: 0 }}>Los gestores tienen todos los permisos aunque las casillas estén desmarcadas.</p>
    </form>
  );
}

export function MemberEditor({ orgId, m, isSelf }: { orgId: string; m: MemberRow; isSelf: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(updateMember, idle);
  const [rmState, rmAction] = useActionState<ActionState, FormData>(removeMember, idle);
  return (
    <details>
      <summary className="btn btn-ghost btn-sm" style={{ display: "inline-flex" }}>Editar permisos{isSelf ? " (usted)" : ""}</summary>
      <div className="card card-body" style={{ marginTop: 8 }}>
        <form className="form" onSubmit={submitWith(action)} noValidate>
          <input type="hidden" name="org_id" value={orgId} />
          <input type="hidden" name="user_id" value={m.user_id} />
          <PermFields prefix={`m-${m.user_id}`} m={m} />
          <FormMessage state={state} />
          <div><SubmitButton>Guardar permisos</SubmitButton></div>
        </form>
        <form
          className="form"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirm(isSelf ? "¿Salir de la agencia? Perderá acceso a sus datos." : `¿Quitar a ${m.full_name || m.email || "este miembro"} de la agencia?`)) return;
            const fd = new FormData(e.currentTarget);
            startTransition(() => rmAction(fd));
          }}
        >
          <input type="hidden" name="org_id" value={orgId} />
          <input type="hidden" name="user_id" value={m.user_id} />
          <FormMessage state={rmState} />
          <div>
            <button type="submit" className="btn btn-sm btn-danger">{isSelf ? "Salir de la agencia" : "Quitar de la agencia"}</button>
          </div>
        </form>
      </div>
    </details>
  );
}
