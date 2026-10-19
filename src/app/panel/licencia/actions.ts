"use server";
// Pago manual de licencia: se registra como "pendiente" con su comprobante. Nunca activa nada:
// solo el personal de MAJ aprueba pagos y activa licencias.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import { optNumber, optText, zodFieldErrors } from "@/lib/listing-editor/schemas";
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.panel.msg;
const F = es.editor.fieldLabels;

const paymentSchema = z.object({
  license_id: z.uuid(M.pickLicense),
  amount: optNumber(0.01, 999999999999, { label: F.amount }).refine((v) => v !== null, M.amountRequired),
  currency: z.enum(["DOP", "USD"], { error: M.currency }),
  method: z.enum(["transferencia", "deposito", "efectivo", "otro"], { error: M.paymentMethod }),
  reference: optText(120, F.reference),
  receipt_path: z.preprocess((v) => (typeof v === "string" && v ? v : null), z.string().max(300).nullable()),
});

export async function submitPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await submitPaymentEs(_prev, fd), await getLocale());
}
async function submitPaymentEs(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: M.demoDb };
  const user = await getSessionUser();
  if (!user) return { status: "error", message: M.sessionExpired };
  const r = paymentSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.reviewFields, errors: zodFieldErrors(r.error) };
  const d = r.data;
  if (!d.receipt_path && !d.reference) {
    return { status: "error", message: M.receiptOrReference, errors: { reference: M.referenceOrReceipt } };
  }
  const supabase = await createClient();
  if (d.receipt_path) {
    const prefix = `licenses/${d.license_id}/`;
    const name = d.receipt_path.slice(prefix.length);
    if (!d.receipt_path.startsWith(prefix) || !/^[A-Za-z0-9._-]{1,200}$/.test(name)) {
      return { status: "error", message: M.receiptInvalid };
    }
    const { data: objs } = await supabase.storage.from("private-docs").list(`licenses/${d.license_id}`, { search: name, limit: 5 });
    if (!(objs ?? []).some((o) => o.name === name)) return { status: "error", message: M.receiptNotFound };
  }
  const { data, error } = await supabase
    .from("license_payments")
    .insert({
      license_id: d.license_id,
      submitted_by: user.id,
      amount: d.amount,
      currency: d.currency,
      method: d.method,
      reference: d.reference,
      receipt_path: d.receipt_path,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/licencia");
  return { status: "ok", id: data.id, message: M.licensePaymentOk };
}
