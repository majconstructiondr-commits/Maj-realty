"use server";
// Solicitud para publicar en MAJ. Registra la aceptación de condiciones (versión vigente) y, para agencias,
// crea la organización en estado "pendiente" con el solicitante como gestor inicial.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { dbErrorMessage } from "@/lib/security";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { formToObject } from "@/lib/validation/requests";
import { checkbox, optEmail, optText, zodFieldErrors } from "@/lib/listing-editor/schemas";

const appSchema = z
  .object({
    applicant_type: z.enum(["propietario", "vendedor", "agencia"], { error: "Indique cómo va a publicar" }),
    full_name: z.string({ error: "Indique su nombre completo" }).trim().min(2, "Indique su nombre completo").max(160),
    phone: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().regex(/^[0-9+()\s-]{7,25}$/, "Teléfono no válido").nullable()),
    requested_plan_id: z.preprocess((v) => (v ? v : null), z.uuid("Plan no válido").nullable()),
    notes: optText(1500, "Las notas"),
    accept_terms: checkbox.refine((v) => v, "Debe aceptar las condiciones de publicación"),
    id_doc_path: z.preprocess((v) => (typeof v === "string" && v ? v : null), z.string().max(300).nullable()),
    org_name: optText(160, "El nombre de la agencia"),
    org_legal_name: optText(200, "La razón social"),
    org_rnc: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().regex(/^[0-9-]{9,20}$/, "RNC no válido").nullable()),
    org_phone: optText(40, "El teléfono"),
    org_email: optEmail,
  })
  .superRefine((d, ctx) => {
    if (d.applicant_type === "agencia" && (!d.org_name || d.org_name.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["org_name"], message: "Indique el nombre comercial de la agencia" });
    }
  });

export async function submitApplication(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasSupabase) return { status: "error", message: "Modo demostración: la base de datos no está configurada." };
  const user = await getSessionUser();
  if (!user) return { status: "error", message: "Su sesión expiró. Inicie sesión de nuevo." };
  if (!user.emailConfirmed) return { status: "error", message: "Primero verifique su correo electrónico con el enlace que le enviamos." };
  const r = appSchema.safeParse(formToObject(fd));
  if (!r.success) return { status: "error", message: "Revise los campos marcados.", errors: zodFieldErrors(r.error) };
  const d = r.data;
  if (d.id_doc_path) {
    const prefix = `profiles/${user.id}/`;
    if (!d.id_doc_path.startsWith(prefix) || !/^[A-Za-z0-9._-]{1,200}$/.test(d.id_doc_path.slice(prefix.length))) {
      return { status: "error", message: "Documento no válido." };
    }
  }
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("publisher_applications")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pendiente", "documentos_requeridos"])
    .limit(1);
  if (open?.length) return { status: "error", message: "Ya tiene una solicitud en revisión. Le avisaremos cuando MAJ la revise." };

  if (d.requested_plan_id) {
    const { data: plan } = await supabase.from("plans").select("id, holder_type").eq("id", d.requested_plan_id).eq("is_active", true).maybeSingle();
    if (!plan) return { status: "error", message: "El plan seleccionado no está disponible.", errors: { requested_plan_id: "Plan no disponible" } };
    const expected = d.applicant_type === "agencia" ? "organizacion" : "individual";
    if (plan.holder_type !== expected) {
      return { status: "error", message: "El plan no corresponde al tipo de solicitante.", errors: { requested_plan_id: d.applicant_type === "agencia" ? "Elija un plan para agencias" : "Elija un plan individual" } };
    }
  }

  const termsVersion = String((await getSiteSettings())["legal.documents_version"] ?? "");
  if (!termsVersion) return { status: "error", message: "No se pudo determinar la versión de las condiciones. Intente más tarde." };

  const prof = await supabase
    .from("profiles")
    .update({ full_name: d.full_name, terms_version_accepted: termsVersion, terms_accepted_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id");
  if (prof.error || !prof.data?.length) return { status: "error", message: dbErrorMessage(prof.error) };
  if (d.phone) {
    const pp = await supabase.from("profile_private").update({ phone: d.phone }).eq("user_id", user.id).select("user_id");
    if (pp.error) return { status: "error", message: dbErrorMessage(pp.error) };
  }

  let organizationId: string | null = null;
  if (d.applicant_type === "agencia") {
    // Reutiliza una agencia pendiente creada antes por el mismo usuario (p. ej., tras un rechazo).
    const { data: existing } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (existing?.length && existing[0].status !== "suspendida") {
      organizationId = existing[0].id;
    } else {
      const org = await supabase
        .from("organizations")
        .insert({ name: d.org_name, legal_name: d.org_legal_name, rnc: d.org_rnc, phone: d.org_phone, email: d.org_email, created_by: user.id })
        .select("id")
        .single();
      if (org.error || !org.data) return { status: "error", message: dbErrorMessage(org.error) };
      organizationId = org.data.id;
      const mem = await supabase
        .from("organization_members")
        .insert({ organization_id: organizationId, user_id: user.id, member_role: "gestor", can_publish: true, can_view_all_listings: true, can_manage_members: true, can_view_leads: true, added_by: user.id })
        .select("user_id");
      if (mem.error || !mem.data?.length) return { status: "error", message: dbErrorMessage(mem.error) };
    }
  }

  const notes = [d.notes, d.id_doc_path ? `Documento de identidad cargado: ${d.id_doc_path}` : null].filter(Boolean).join("\n\n") || null;
  const { data, error } = await supabase
    .from("publisher_applications")
    .insert({
      user_id: user.id,
      applicant_type: d.applicant_type,
      organization_id: organizationId,
      requested_plan_id: d.requested_plan_id,
      terms_version: termsVersion,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error) };
  revalidatePath("/panel/publicar");
  return { status: "ok", id: data.id, message: "Solicitud enviada. El equipo de MAJ la revisará y le avisará por correo y en su panel." };
}
