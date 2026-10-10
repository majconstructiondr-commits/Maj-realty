"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/FormBits";
import { SelectField, TextField } from "@/components/listing-editor/fields";
import { idle, type ActionState } from "@/lib/action-state";
import { requestRentCollection } from "./rent-actions";

export function RentCollectionForm({ propertyId, feePercent, today }: { propertyId: string; feePercent: number; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestRentCollection, idle);
  const errors = state.status === "error" ? state.errors : undefined;
  if (state.status === "ok") return <p className="alert alert-success small" role="status">{state.message}</p>;
  const id = (n: string) => `rc-${n}-${propertyId}`;
  return (
    <form action={action} className="form">
      <input type="hidden" name="property_id" value={propertyId} />
      <p className="small" style={{ margin: 0 }}>
        MAJ REALTY le cobra la renta a su inquilino cada mes, le envía los avisos de pago y le lleva el registro. La comisión es de <strong>{feePercent}%</strong> de cada renta cobrada y se descuenta de lo que usted recibe.
      </p>
      <div className="form-grid">
        <TextField id={id("name")} name="tenant_name" label="Nombre del inquilino" required errors={errors} maxLength={160} />
        <TextField id={id("unit")} name="unit_label" label="Unidad (opcional)" errors={errors} maxLength={60} placeholder="Ej.: Apto 2B" />
        <TextField id={id("email")} name="tenant_email" label="Correo del inquilino" type="email" errors={errors} maxLength={160} />
        <TextField id={id("phone")} name="tenant_phone" label="Teléfono / WhatsApp del inquilino" inputMode="tel" errors={errors} maxLength={40} />
        <TextField id={id("rent")} name="rent_amount" label="Renta mensual" required inputMode="decimal" errors={errors} />
        <SelectField id={id("cur")} name="currency" label="Moneda" required errors={errors} defaultValue="DOP" options={{ DOP: "Pesos (RD$)", USD: "Dólares (US$)" }} />
        <TextField id={id("day")} name="due_day" label="Día de pago (1 a 28)" required inputMode="numeric" errors={errors} />
        <TextField id={id("start")} name="start_date" label="Primer mes a cobrar desde" type="date" required errors={errors} defaultValue={today} />
      </div>
      <label className="check">
        <input type="checkbox" name="accept" required />
        <span>Acepto la comisión de {feePercent}% por la administración del cobro.</span>
      </label>
      <FormMessage state={state} />
      <div><button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Enviando…" : "Solicitar cobro de renta"}</button></div>
    </form>
  );
}
