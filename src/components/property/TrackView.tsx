"use client";
import { useEffect } from "react";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/** Registra una vista (una por sesión y día). No es un contacto ni una venta. */
export function TrackView({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    if (!hasSupabase || propertyId.startsWith("00000000")) return;
    let sid = "";
    try {
      sid = sessionStorage.getItem("maj_sid") ?? crypto.randomUUID();
      sessionStorage.setItem("maj_sid", sid);
    } catch {
      sid = "";
    }
    void createClient().rpc("track_property_event", { p_property: propertyId, p_kind: "vista", p_session: sid || null });
  }, [propertyId]);
  return null;
}
