"use client";
import { useState } from "react";
import type { CatalogMedia } from "@/lib/catalog/types";
import { PlaceholderArt } from "./PlaceholderArt";
import { fmt } from "@/i18n/fmt";
import { es, type Dictionary } from "@/i18n/es";

/** `t`: textos del idioma activo en la ficha pública; la vista previa del panel usa el español por defecto. */
export function Gallery({ media, title, demo, t = es.gallery }: { media: CatalogMedia[]; title: string; demo?: boolean; t?: Dictionary["gallery"] }) {
  const photos = media.filter((m) => (m.kind === "foto" || m.kind === "plano") && m.url);
  const [i, setI] = useState(0);
  if (!photos.length) {
    return (
      <div className="gallery-main">
        <PlaceholderArt label={demo ? t.demoImage : t.noPhotos} />
      </div>
    );
  }
  const cur = photos[Math.min(i, photos.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url!} alt={cur.alt_text || fmt(t.photoAlt, { title, n: i + 1 })} />
      </div>
      {photos.length > 1 ? (
        <div className="thumbs" role="list" aria-label={t.photos}>
          {photos.map((m, idx) => (
            <button key={m.id} type="button" role="listitem" aria-current={idx === i ? "true" : undefined} aria-label={`${fmt(t.viewPhoto, { n: idx + 1 })}${m.kind === "plano" ? t.floorPlan : ""}`} onClick={() => setI(idx)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url!} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <p className="xs muted">{fmt(t.count, { n: photos.length })}</p>
    </div>
  );
}
