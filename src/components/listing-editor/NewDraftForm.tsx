"use client";
import { useActionState } from "react";
import { createDraft } from "@/app/panel/publicaciones/actions";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/catalog/definitions";
import { SelectField, TextField } from "./fields";

export function NewDraftForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createDraft, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  return (
    <form action={action} className="form card card-body">
      <div className="form-grid">
        <TextField className="span-2" name="title" label="Título" required maxLength={140} errors={errors}
          hint="Podrá cambiarlo después. Mínimo 5 caracteres." placeholder="Ej.: Casa de 3 habitaciones en Arroyo Hondo" />
        <SelectField name="operation" label="Operación" required options={OPERATIONS} defaultValue="venta" errors={errors} />
        <SelectField name="property_type" label="Tipo de inmueble" required options={PROPERTY_TYPES} defaultValue="apartamento" errors={errors} />
        {orgs.length ? (
          <SelectField className="span-2" name="organization_id" label="Publicar como" placeholder="A mi nombre (licencia individual)"
            options={Object.fromEntries(orgs.map((o) => [o.id, `Agencia: ${o.name}`]))} errors={errors}
            hint="Si publica a nombre de su agencia, se usará la licencia de la agencia y sus gestores podrán editarla." />
        ) : null}
      </div>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Creando…">Crear borrador y continuar</SubmitButton></div>
    </form>
  );
}
