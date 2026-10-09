"use client";
import { useState } from "react";
import type { CatalogMedia } from "@/lib/catalog/types";
import { PlaceholderArt } from "./PlaceholderArt";

export function Gallery({ media, title, demo }: { media: CatalogMedia[]; title: string; demo?: boolean }) {
  const photos = media.filter((m) => (m.kind === "foto" || m.kind === "plano") && m.url);
  const [i, setI] = useState(0);
  if (!photos.length) {
    return (
      <div className="gallery-main">
        <PlaceholderArt label={demo ? "Imagen de demostración" : "Sin fotos disponibles"} />
      </div>
    );
  }
  const cur = photos[Math.min(i, photos.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url!} alt={cur.alt_text || `${title}, foto ${i + 1}`} />
      </div>
      {photos.length > 1 ? (
        <div className="thumbs" role="list" aria-label="Fotos">
          {photos.map((m, idx) => (
            <button key={m.id} type="button" role="listitem" aria-current={idx === i ? "true" : undefined} aria-label={`Ver foto ${idx + 1}${m.kind === "plano" ? " (plano)" : ""}`} onClick={() => setI(idx)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url!} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <p className="xs muted">{photos.length} imagen(es)</p>
    </div>
  );
}
