"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { CONTRACT_STATUSES, MGMT_DOC_KINDS, MGMT_SERVICES, MOVEMENT_KINDS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/admin/labels";
import {
  parseForm, zCurrency, zDate, zEnumOf, zNum, zOptDate, zOptNum, zOptText, zOptUuid, zPeriod, zReason, zText, zUuid,
} from "@/lib/admin/form";
import { confirmRows, fail, findUserByEmail, ok, safeStoragePath, staffCtx, type Db } from "@/lib/admin/server";

const path = (id: string) => `/admin/administracion/${id}`;
const services = z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(zEnumOf(MGMT_SERVICES)).max(10));

const contractFields = {
  property_label: zText(200, 2, "Indique el inmueble administrado"),
  location_summary: zOptText(300),
  property_id: zOptUuid,
  units: zNum({ int: true, min: 1, max: 10000 }),
  services,
  fee_terms: zOptText(2000),
  start_date: zDate,
  end_date: zOptDate,
  status: zEnumOf(CONTRACT_STATUSES),
};

/** Otorga el rol propietario (solo administradores pueden escribir user_roles). */
async function grantOwner(supabase: Db, userId: string, grantedBy: string) {
  const { error } = await supabase.from("user_roles")
    .upsert({ user_id: userId, role: "propietario", granted_by: grantedBy }, { onConflict: "user_id,role", ignoreDuplicates: true });
  return !error;
}

export async function createContract(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, isAdmin } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ ...contractFields, owner_email: z.email("Correo del propietario no válido"), request_id: zOptUuid })
    .refine((d) => !d.end_date || d.end_date >= d.start_date, { message: "La fecha final debe ser posterior al inicio", path: ["end_date"] }), fd);
  if (!f.ok) return f.state;
  const owner = await findUserByEmail(supabase, f.data.owner_email);
  if (owner.error !== undefined) return fail(owner.error);
  const { owner_email: _e, ...row } = f.data;
  void _e;
  const { data, error } = await supabase.from("management_contracts")
    .insert({ ...row, end_date: row.end_date ?? null, owner_user_id: owner.user.id, created_by: user.id })
    .select("id").single();
  if (error || !data) return fail(error);
  const granted = isAdmin ? await grantOwner(supabase, owner.user.id, user.id) : false;
  redirect(`${path(data.id)}?rol=${granted ? "ok" : "pendiente"}`);
}

export async function updateContract(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ ...contractFields, id: zUuid })
    .refine((d) => !d.end_date || d.end_date >= d.start_date, { message: "La fecha final debe ser posterior al inicio", path: ["end_date"] }), fd);
  if (!f.ok) return f.state;
  const { id, ...row } = f.data;
  const res = await supabase.from("management_contracts")
    .update({ ...row, end_date: row.end_date ?? null, property_id: row.property_id ?? null, location_summary: row.location_summary ?? null, fee_terms: row.fee_terms ?? null })
    .eq("id", id).select("id");
  revalidatePath(path(id));
  return confirmRows(res, "Contrato actualizado.");
}

export async function grantOwnerRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, isAdmin } = await staffCtx("/admin/administracion");
  if (!isAdmin) return fail("Solo un administrador puede otorgar roles. Pida a un administrador que otorgue el rol propietario.");
  const f = parseForm(z.object({ contract_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const { data: c } = await supabase.from("management_contracts").select("owner_user_id").eq("id", f.data.contract_id).maybeSingle();
  if (!c) return fail("Contrato no encontrado.");
  if (!(await grantOwner(supabase, c.owner_user_id as string, user.id))) return fail("No se pudo otorgar el rol.");
  revalidatePath(path(f.data.contract_id));
  return ok("Rol propietario otorgado. El propietario ya puede ver su portal.");
}

const DIRECTION: Record<string, "ingreso" | "egreso"> = {
  renta_cobrada: "ingreso", gasto: "egreso", mantenimiento: "egreso", comision: "egreso", pago_al_propietario: "egreso",
};

export async function addMovement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({
    contract_id: zUuid,
    kind: zEnumOf(MOVEMENT_KINDS),
    direction: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["ingreso", "egreso"]).optional()),
    amount: zNum({ min: 0.01, max: 1e12, msg: "Monto no válido" }),
    currency: zCurrency,
    movement_date: zDate,
    period: zPeriod,
    description: zText(500, 2, "Describa el movimiento"),
    unit_label: zOptText(60),
    storage_path: zOptText(400),
  }), fd);
  if (!f.ok) return f.state;
  const d = f.data;
  const direction = DIRECTION[d.kind] ?? d.direction;
  if (!direction) return fail("Indique si el ajuste es ingreso o egreso.");
  if (d.storage_path && !safeStoragePath(d.storage_path, `management/${d.contract_id}/`)) return fail("Ruta de comprobante no válida.");
  const { storage_path, ...row } = d;
  const { error } = await supabase.from("management_movements").insert({ ...row, direction, unit_label: row.unit_label ?? null, receipt_path: storage_path ?? null });
  if (error) return fail(error);
  revalidatePath(path(d.contract_id));
  return ok("Movimiento registrado.");
}

export async function reconcileMovement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ id: zUuid, contract_id: zUuid }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("management_movements").update({ status: "conciliado" })
    .eq("id", f.data.id).eq("contract_id", f.data.contract_id).eq("status", "registrado").select("id");
  revalidatePath(path(f.data.contract_id));
  return confirmRows(res, "Movimiento conciliado.");
}

export async function voidMovement(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ id: zUuid, contract_id: zUuid, reason: zReason }), fd);
  if (!f.ok) return f.state;
  const res = await supabase.from("management_movements").update({ status: "anulado", void_reason: f.data.reason })
    .eq("id", f.data.id).eq("contract_id", f.data.contract_id).neq("status", "anulado").select("id");
  revalidatePath(path(f.data.contract_id));
  return confirmRows(res, "Movimiento anulado. Registre uno nuevo si corresponde.");
}

export async function attachReceipt(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({ id: zUuid, contract_id: zUuid, storage_path: zText(400) }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `management/${f.data.contract_id}/`)) return fail("Ruta de comprobante no válida.");
  const res = await supabase.from("management_movements").update({ receipt_path: f.data.storage_path })
    .eq("id", f.data.id).eq("contract_id", f.data.contract_id).select("id");
  revalidatePath(path(f.data.contract_id));
  return confirmRows(res, "Comprobante adjuntado.");
}

export async function addTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({
    contract_id: zUuid, title: zText(160, 3, "Indique el título (mínimo 3 caracteres)"), description: zOptText(3000),
    priority: zEnumOf(TICKET_PRIORITIES), estimated_cost: zOptNum({ min: 0, max: 1e12 }),
    currency: z.preprocess((v) => (v === "" ? undefined : v), zCurrency.optional()),
  }).refine((d) => d.estimated_cost === undefined || d.currency, { message: "Indique la moneda del costo estimado", path: ["currency"] }), fd);
  if (!f.ok) return f.state;
  const { error } = await supabase.from("maintenance_tickets").insert({ ...f.data, created_by: user.id, status: "abierto" });
  if (error) return fail(error);
  revalidatePath(path(f.data.contract_id));
  return ok("Ticket de mantenimiento creado.");
}

export async function updateTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({
    id: zUuid, contract_id: zUuid, status: zEnumOf(TICKET_STATUSES), priority: zEnumOf(TICKET_PRIORITIES),
    estimated_cost: zOptNum({ min: 0, max: 1e12 }), currency: z.preprocess((v) => (v === "" ? undefined : v), zCurrency.optional()),
  }).refine((d) => d.estimated_cost === undefined || d.currency, { message: "Indique la moneda del costo estimado", path: ["currency"] }), fd);
  if (!f.ok) return f.state;
  const { id, contract_id, ...row } = f.data;
  const res = await supabase.from("maintenance_tickets")
    .update({ ...row, estimated_cost: row.estimated_cost ?? null, currency: row.currency ?? null })
    .eq("id", id).eq("contract_id", contract_id).select("id");
  revalidatePath(path(contract_id));
  return confirmRows(res, "Ticket actualizado.");
}

export async function addManagementDocument(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await staffCtx("/admin/administracion");
  const f = parseForm(z.object({
    contract_id: zUuid, kind: zEnumOf(MGMT_DOC_KINDS), title: zText(200, 2, "Indique el título"),
    period: z.preprocess((v) => (v === "" ? undefined : v), zPeriod.optional()), storage_path: zText(400, 1, "Falta el archivo"),
  }), fd);
  if (!f.ok) return f.state;
  if (!safeStoragePath(f.data.storage_path, `management/${f.data.contract_id}/`)) return fail("Ruta de archivo no válida.");
  const { error } = await supabase.from("management_documents").insert({ ...f.data, period: f.data.period ?? null, created_by: user.id });
  if (error) return fail(error);
  revalidatePath(path(f.data.contract_id));
  return ok("Documento cargado. El propietario lo verá en su portal.");
}
