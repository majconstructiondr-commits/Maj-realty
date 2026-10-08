"use client";
import { whatsappLink } from "@/lib/whatsapp";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./Icon";

/**
 * Botón de WhatsApp. Registra únicamente "clic en WhatsApp" para estadísticas;
 * no marca la conversación como enviada ni el contacto como confirmado.
 */
export function WhatsAppLink({
  number,
  text,
  label = "Consultar por WhatsApp",
  propertyId,
  className = "btn btn-whatsapp",
  floating = false,
}: {
  number: string;
  text?: string;
  label?: string;
  propertyId?: string;
  className?: string;
  floating?: boolean;
}) {
  const href = whatsappLink(number, text);
  function onClick() {
    if (!propertyId || !hasSupabase) return;
    try {
      void createClient().rpc("track_property_event", { p_property: propertyId, p_kind: "clic_whatsapp", p_session: null });
    } catch {
      /* las estadísticas nunca bloquean el contacto */
    }
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={floating ? "wa-float" : className}
      onClick={onClick}
      aria-label={floating ? `${label} (se abre WhatsApp)` : undefined}
    >
      <Icon name="whatsapp" size={floating ? 24 : 20} />
      <span>{label}</span>
    </a>
  );
}
