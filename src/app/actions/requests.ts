"use server";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { checkHuman, clientIpHash, dbErrorMessage, rateLimit } from "@/lib/security";
import { contactSchema, detailSchemas, fieldErrors, formToObject, type RequestKindWithSchema } from "@/lib/validation/requests";
import { getSiteSettings } from "@/lib/site";

export type RequestState =
  | { status: "idle" }
  | { status: "error"; message: string; errors?: Record<string, string> }
  | { status: "ok"; number: string; createdAt: string; id: string; uploadToken: string };

/**
 * Crea una solicitud real. Solo devuelve "ok" cuando la base de datos confirmó el registro
 * y entregó un número; en cualquier otro caso devuelve un error (sin confirmaciones falsas).
 */
export async function submitServiceRequest(_prev: RequestState, fd: FormData): Promise<RequestState> {
  const kind = String(fd.get("kind") ?? "") as RequestKindWithSchema;
  if (!(kind in detailSchemas)) return { status: "error", message: "Tipo de solicitud no válido." };

  if (!hasSupabase) {
    return {
      status: "error",
      message: "Modo demostración: la base de datos no está configurada y su solicitud NO se guardó. Escríbanos por WhatsApp.",
    };
  }
  if (!(await checkHuman(fd))) {
    return { status: "error", message: "No pudimos verificar el envío. Espere unos segundos e intente de nuevo." };
  }
  const ip = await clientIpHash();
  if (!rateLimit(`req:${ip}`, 8, 60 * 60 * 1000)) {
    return { status: "error", message: "Demasiados envíos desde su conexión. Intente más tarde o escríbanos por WhatsApp." };
  }

  const raw = formToObject(fd);
  const contact = contactSchema.safeParse(raw);
  const details = detailSchemas[kind].safeParse(raw);
  if (!contact.success || !details.success) {
    const errors = {
      ...(contact.success ? {} : fieldErrors(contact.error)),
      ...(details.success ? {} : fieldErrors(details.error)),
    };
    return { status: "error", message: "Revise los campos marcados.", errors };
  }
  const propertyId = typeof raw.property_id === "string" && /^[0-9a-f-]{36}$/.test(raw.property_id) ? raw.property_id : null;
  const propertyRef = typeof raw.property_ref === "string" ? raw.property_ref.slice(0, 60) : null;

  const supabase = await createClient();
  const s = await getSiteSettings();
  const { data, error } = await supabase.rpc("create_service_request", {
    p_kind: kind,
    p_contact_name: contact.data.contact_name,
    p_contact_email: contact.data.contact_email ?? null,
    p_contact_phone: contact.data.contact_phone ?? null,
    p_preferred_channel: contact.data.preferred_channel,
    p_message: contact.data.message ?? null,
    p_details: details.data,
    p_property_id: propertyId,
    p_property_ref: propertyRef,
    p_contact_consent: contact.data.contact_consent,
    p_marketing_consent: contact.data.marketing_consent,
    p_consent_version: s["legal.documents_version"],
  });
  if (error || !data?.number) return { status: "error", message: dbErrorMessage(error) };
  return { status: "ok", number: data.number, createdAt: data.created_at, id: data.id, uploadToken: data.upload_token };
}
