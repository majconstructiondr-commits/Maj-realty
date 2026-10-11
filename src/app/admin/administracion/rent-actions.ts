"use server";
// Cobro de rentas: alquileres (inquilinos), cuotas mensuales y revisión de pagos informados por el inquilino.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseForm, zCurrency, zDate, zNum, zOptDate, zOptText, zPeriod, zReason, zText, zUuid } from "@/lib/admin/form";
import { confirmRows, fail, ok, staffCtx } from "@/lib/admin/server";

const path = (id: string) => `/admin/administracion/${id}`;

export async function createLease(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({
    contract_id: zUuid,
    unit_label: zOptText(60),
    tenant_name: zText(160, 2, "Indique el nombre del inquilino"),
    tenant_email: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined), z.email("Correo no válido").optional()),
    tenant_phone: zOptText(40),
    rent_amount: zNum({ min: 0.01, max: 1e12, msg: "Indique la renta mensual" }),
    currency: zCurrency,
    due_day: zNum({ int: true, min: 1, max: 28, msg: "Día de pago entre 1 y 28" }),
    start_date: zDate,
    end_date: zOptDate,
    fee_percent: zNum({ min: 0, max: 100, msg: "Comisión entre 0 y 100" }),
  }).refine((d) => d.tenant_email || d.tenant_phone, { message: "Indique el correo o el teléfono del inquilino", path: ["tenant_email"] })
    .refine((d) => !d.end_date || d.end_date >= d.start_date, { message: "La fecha final debe ser posterior al inicio", path: ["end_date"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("rental_leases").insert({
    ...f.data,
    unit_label: f.data.unit_label ?? null, tenant_email: f.data.tenant_email ?? null, tenant_phone: f.data.tenant_phone ?? null,
    end_date: f.data.end_date ?? null, created_by: user.id,
  });
  if (error) return fail(error);
  revalidatePath(path(f.data.contract_id));
  return ok("Inquilino registrado. Cuando el inquilino entre con ese correo verá sus cuotas en «Mis rentas».");
}

export async function endLease(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ id: zUuid, contract_id: zUuid, end_date: zDate }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("rental_leases").update({ status: "terminado", end_date: f.data.end_date })
    .eq("id", f.data.id).eq("contract_id", f.data.contract_id).select("id");
  revalidatePath(path(f.data.contract_id));
  return confirmRows(res, "Alquiler terminado. No se generarán más cuotas.");
}

export async function generateCharges(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ period: zPeriod, contract_id: z.preprocess((v) => v || undefined, zUuid.optional()) }), fd);
  if (!f.ok) return f.state;
  const { data, error } = await supabase.rpc("generate_rent_charges", { p_period: f.data.period });
  if (error) return fail(error);
  if (f.data.contract_id) revalidatePath(path(f.data.contract_id));
  revalidatePath("/admin/rentas");
  return ok(data ? `${data} cuota(s) creada(s) para ${f.data.period}.` : `No había cuotas nuevas para ${f.data.period} (ya existen o no hay alquileres activos en contratos activos).`);
}

export async function voidCharge(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ id: zUuid, contract_id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("rent_charges").update({ status: "anulado", void_reason: f.data.reason })
    .eq("id", f.data.id).in("status", ["pendiente"]).select("id");
  revalidatePath(path(f.data.contract_id));
  return confirmRows(res, "Cuota anulada.");
}

export async function reviewRentPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/rentas");
  const f = parseForm(z.object({
    id: zUuid, decision: z.enum(["confirmar", "rechazar"]), reason: zOptText(500),
    contract_id: z.preprocess((v) => v || undefined, zUuid.optional()),
  }).refine((d) => d.decision === "confirmar" || Boolean(d.reason && d.reason.length >= 3), { message: "Indique el motivo del rechazo", path: ["reason"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.rpc("review_rent_payment", { p_payment: f.data.id, p_approve: f.data.decision === "confirmar", p_reason: f.data.reason ?? null });
  if (error) return fail(error);
  if (f.data.contract_id) revalidatePath(path(f.data.contract_id));
  revalidatePath("/admin/rentas");
  return ok(f.data.decision === "confirmar"
    ? "Pago confirmado. Se registraron la renta cobrada y la comisión de MAJ en el contrato."
    : "Pago rechazado. La cuota vuelve a pendiente y se avisó al inquilino.");
}
