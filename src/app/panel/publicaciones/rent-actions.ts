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
import { localizeState } from "@/i18n";
import { es } from "@/i18n/es";
import { getLocale } from "@/i18n/server";

// Mensajes en español desde el diccionario; las acciones exportadas los traducen al responder.
const M = es.editor.msg;
const F = es.editor.fieldLabels;

const schema = z.object({
  property_id: z.uuid(),
  tenant_name: z.string().trim().min(2, M.tenantName).max(160),
  tenant_email: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null), z.email(M.emailInvalid).nullable()),
  tenant_phone: optText(40, F.phone),
  rent_amount: optNumber(0.01, 999999999999, { label: F.rent }).refine((v) => v !== null, M.rentRequired),
  currency: z.enum(["DOP", "USD"], { error: M.currency }),
  due_day: optNumber(1, 28, { int: true, label: F.dueDay }).refine((v) => v !== null, M.dueDayRequired),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, M.startDate),
  unit_label: optText(60, F.unit),
  accept: z.literal("on", { error: M.acceptFee }),
}).refine((d) => d.tenant_email || d.tenant_phone, { message: M.tenantContact, path: ["tenant_email"] });

export async function requestRentCollection(_p: ActionState, fd: FormData): Promise<ActionState> {
  return localizeState(await requestRentCollectionEs(_p, fd), await getLocale());
}
async function requestRentCollectionEs(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { status: "error", message: M.sessionExpired };
  const r = schema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: M.reviewFields, errors: zodFieldErrors(r.error) };
  const d = r.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_rent_collection", {
    p_property: d.property_id, p_tenant_name: d.tenant_name, p_tenant_email: d.tenant_email, p_tenant_phone: d.tenant_phone,
    p_rent_amount: d.rent_amount, p_currency: d.currency, p_due_day: d.due_day, p_start_date: d.start_date, p_unit_label: d.unit_label,
  });
  if (error) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/publicaciones");
  return { status: "ok", message: M.rentRequestSent };
}
