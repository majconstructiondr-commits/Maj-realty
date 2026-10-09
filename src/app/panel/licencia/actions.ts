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

const paymentSchema = z.object({
  license_id: z.uuid("Seleccione la licencia"),
  amount: optNumber(0.01, 999999999999, { label: "El monto" }).refine((v) => v !== null, "Indique el monto pagado"),
  currency: z.enum(["DOP", "USD"], { error: "Seleccione la moneda" }),
  method: z.enum(["transferencia", "deposito", "efectivo", "otro"], { error: "Seleccione el método de pago" }),
  reference: optText(120, "La referencia"),
  receipt_path: z.preprocess((v) => (typeof v === "string" && v ? v : null), z.string().max(300).nullable()),
});

export async function submitPayment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: "Modo demostración: la base de datos no está configurada." };
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Su sesión expiró. Inicie sesión de nuevo." };
  const r = paymentSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: "Revise los campos marcados.", errors: zodFieldErrors(r.error) };
  const d = r.data;
  if (!d.receipt_path && !d.reference) {
    return { status: "error", message: "Adjunte el comprobante o indique la referencia de la transacción.", errors: { reference: "Indique la referencia o adjunte el comprobante" } };
  }
  const supabase = await createClient();
  if (d.receipt_path) {
    const prefix = `licenses/${d.license_id}/`;
    const name = d.receipt_path.slice(prefix.length);
    if (!d.receipt_path.startsWith(prefix) || !/^[A-Za-z0-9._-]{1,200}$/.test(name)) {
      return { status: "error", message: "Comprobante no válido." };
    }
    const { data: objs } = await supabase.storage.from("private-docs").list(`licenses/${d.license_id}`, { search: name, limit: 5 });
    if (!(objs ?? []).some((o) => o.name === name)) return { status: "error", message: "No se encontró el comprobante cargado. Intente de nuevo." };
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
  return { status: "ok", id: data.id, message: "Pago registrado como pendiente. MAJ verificará el comprobante y le avisará; su licencia no cambia hasta esa verificación." };
}
