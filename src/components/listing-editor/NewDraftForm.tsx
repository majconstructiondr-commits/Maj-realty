"use client";
import { useActionState } from "react";
import { createDraft } from "@/app/panel/publicaciones/actions";
import { FormMessage, SubmitButton } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import { fmt, usePrivateI18n } from "@/i18n/client";
import { SelectField, TextField } from "./fields";

export function NewDraftForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createDraft, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  const { d } = usePrivateI18n();
  const t = d.editor.newDraft;
  return (
    <form action={action} className="form card card-body">
      <div className="form-grid">
        <TextField className="span-2" name="title" label={t.titleLabel} required maxLength={140} errors={errors}
          hint={t.titleHint} placeholder={t.titlePlaceholder} />
        <SelectField name="operation" label={d.editor.basics.operation} required options={d.labels.operations} defaultValue="venta" errors={errors} />
        <SelectField name="property_type" label={d.common.propertyType} required options={d.labels.propertyTypes} defaultValue="apartamento" errors={errors} />
        {orgs.length ? (
          <SelectField className="span-2" name="organization_id" label={t.publishAs} placeholder={t.asMe}
            options={Object.fromEntries(orgs.map((o) => [o.id, fmt(t.asAgency, { name: o.name })]))} errors={errors}
            hint={t.agencyHint} />
        ) : null}
      </div>
      <FormMessage state={state} />
      <div><SubmitButton pendingText={t.creating}>{t.create}</SubmitButton></div>
    </form>
  );
}
