import { cache } from "react";
import { hasSupabase } from "./env";
import { createClient } from "./supabase/server";

// Valores iniciales. Los datos definitivos se editan en Panel → Configuración (tabla site_settings).
// Lo marcado como null está POR CONFIRMAR y no se muestra como dato activo.
export const defaultSettings = {
  "company.name": "MAJ REALTY SRL",
  "company.phones": ["849-802-8181", "809-770-6277", "849-272-5000"],
  "company.primary_phone": "849-802-8181",
  "company.email": null as string | null,
  "company.address": null as string | null,
  "company.rnc": "131090443" as string | null,
  "company.hours": null as string | null,
  "whatsapp.primary": "18097706277",
  "whatsapp.secondary": "18492725000",
  "whatsapp.routing": "equipo" as "equipo" | "asesor",
  "whatsapp.template": "Hola, me interesa {servicio}, referencia {codigo}, enlace {url}",
  "appointments.duration_minutes": 60,
  "appointments.min_lead_hours": 12,
  "appointments.hours": {
    "1": ["09:00", "17:00"],
    "2": ["09:00", "17:00"],
    "3": ["09:00", "17:00"],
    "4": ["09:00", "17:00"],
    "5": ["09:00", "17:00"],
    "6": ["09:00", "13:00"],
  } as Record<string, [string, string]>,
  "support.response_time_text": "Respondemos en horario laborable.",
  "legal.documents_version": "borrador-2026-10-08",
};

export type SiteSettings = typeof defaultSettings;

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!hasSupabase) return defaultSettings;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("site_settings").select("key, value").eq("is_public", true);
    if (error || !data) return defaultSettings;
    const merged: Record<string, unknown> = { ...defaultSettings };
    for (const row of data) merged[row.key] = row.value;
    return merged as SiteSettings;
  } catch {
    return defaultSettings;
  }
});
