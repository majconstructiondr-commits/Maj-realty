"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { SelectField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { fmt, usePrivateI18n } from "@/i18n/client";
import { requestRentCollection } from "./rent-actions";

export function RentCollectionForm({ propertyId, feePercent, today }: { propertyId: string; feePercent: number; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestRentCollection, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  const { d } = usePrivateI18n();
  const t = d.editor.rentCollection;
  if (state.status === "ok") return <p className="alert alert-success small" role="status">{state.message}</p>;
  const id = (n: string) => `rc-${n}-${propertyId}`;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <p className="small" style={{ margin: 0 }}>
        {t.intro} <strong>{feePercent}%</strong> {t.introAfter}
      </p>
      <div className="form-grid">
        <TextField id={id("name")} name="tenant_name" label={t.tenantName} required errors={errors} maxLength={160} />
        <TextField id={id("unit")} name="unit_label" label={t.unit} errors={errors} maxLength={60} placeholder={t.unitPlaceholder} />
        <TextField id={id("email")} name="tenant_email" label={t.tenantEmail} type="email" errors={errors} maxLength={160} />
        <TextField id={id("phone")} name="tenant_phone" label={t.tenantPhone} inputMode="tel" errors={errors} maxLength={40} />
        <TextField id={id("rent")} name="rent_amount" label={t.rent} required inputMode="decimal" errors={errors} />
        <SelectField id={id("cur")} name="currency" label={t.currency} required errors={errors} defaultValue="DOP" options={{ DOP: d.common.currencyDOP, USD: d.common.currencyUSD }} />
        <TextField id={id("day")} name="due_day" label={t.dueDay} required inputMode="numeric" errors={errors} />
        <TextField id={id("start")} name="start_date" label={t.start} type="date" required errors={errors} defaultValue={today} />
      </div>
      <label className="check">
        <input type="checkbox" name="accept" required />
        <span>{fmt(t.accept, { pct: feePercent })}</span>
      </label>
      <FormMessage state={state} />
      <div><button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? t.sending : t.submit}</button></div>
    </form>
  );
}
