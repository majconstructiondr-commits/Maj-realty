"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { CatalogListing } from "@/lib/catalog/types";
import { listingHref } from "./ListingCard";

/** Mapa con zonas APROXIMADAS (círculos de ~1 km). Nunca muestra la dirección exacta. */
export function CatalogMap({ items, back }: { items: CatalogListing[]; back: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const withCoords = items.filter((i) => i.approx_lat && i.approx_lng);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([18.7357, -70.1627], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const bounds: [number, number][] = [];
      for (const l of withCoords) {
        const ll: [number, number] = [Number(l.approx_lat), Number(l.approx_lng)];
        bounds.push(ll);
        const a = document.createElement("a");
        a.href = listingHref(l, back);
        a.textContent = `${l.code} · ${l.title}`;
        L.circle(ll, { radius: 900, color: "#0b1f3a", fillColor: "#c9a54c", fillOpacity: 0.35, weight: 1 })
          .addTo(map)
          .bindPopup(a);
      }
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [withCoords, back]);
  return (
    <div className="stack">
      <div ref={ref} className="map-frame" role="region" aria-label="Mapa de ubicaciones aproximadas" />
      <p className="xs muted">
        Las zonas son aproximadas. La dirección exacta se comparte solo con autorización del propietario. {items.length - withCoords.length > 0
          ? `${items.length - withCoords.length} inmueble(s) sin ubicación en el mapa.`
          : ""}
      </p>
      <ul className="small">
        {items.map((l) => (
          <li key={l.id}><a href={listingHref(l, back)}>{l.code} · {l.title}</a></li>
        ))}
      </ul>
    </div>
  );
}
