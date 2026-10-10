"use server";
// Opción para propietarios con publicaciones en renta: pedir a MAJ la administración del cobro (comisión del propietario).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getSessionUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import { optNumber, optText, zodFieldErrors } from "@/lib/listing-editor/schemas";

const schema = z.object({
  property_id: z.uuid(),
  tenant_name: z.string().trim().min(2, "Indique el nombre del inquilino").max(160),
  tenant_email: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null), z.email("Correo no válido").nullable()),
  tenant_phone: optText(40, "El teléfono"),
  rent_amount: optNumber(0.01, 999999999999, { label: "La renta" }).refine((v) => v !== null, "Indique la renta mensual"),
  currency: z.enum(["DOP", "USD"], { error: "Seleccione la moneda" }),
  due_day: optNumber(1, 28, { int: true, label: "El día de pago" }).refine((v) => v !== null, "Indique el día de pago (1 a 28)"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indique la fecha de inicio"),
  unit_label: optText(60, "La unidad"),
  accept: z.literal("on", { error: "Acepte la comisión para continuar" }),
}).refine((d) => d.tenant_email || d.tenant_phone, { message: "Indique el correo o el teléfono del inquilino", path: ["tenant_email"] });

export async function requestRentCollection(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Su sesión expiró. Inicie sesión de nuevo." };
  const r = schema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: "Revise los campos marcados.", errors: zodFieldErrors(r.error) };
  const d = r.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_rent_collection", {
    p_property: d.property_id, p_tenant_name: d.tenant_name, p_tenant_email: d.tenant_email, p_tenant_phone: d.tenant_phone,
    p_rent_amount: d.rent_amount, p_currency: d.currency, p_due_day: d.due_day, p_start_date: d.start_date, p_unit_label: d.unit_label,
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/publicaciones");
  return { status: "ok", message: "Solicitud enviada. MAJ revisará los datos, activará el cobro y le avisará." };
}
