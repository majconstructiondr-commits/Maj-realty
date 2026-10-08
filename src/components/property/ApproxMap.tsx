"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/** Zona aproximada (~1 km). No muestra ni deduce la dirección exacta. */
export function ApproxMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 15,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      L.circle([lat, lng], { radius: 900, color: "#0b1f3a", fillColor: "#c9a54c", fillOpacity: 0.3, weight: 1 }).addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);
  return <div ref={ref} className="map-frame" role="region" aria-label="Mapa de la zona aproximada" />;
}
