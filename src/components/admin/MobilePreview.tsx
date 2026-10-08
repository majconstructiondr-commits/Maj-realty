"use client";

/** Abre la ficha pública en una ventana del ancho de un teléfono (el sitio no permite iframes). */
export function MobilePreview({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="btn btn-ghost btn-sm"
      onClick={(e) => {
        const w = window.open(href, "maj-vista-movil", "width=390,height=844");
        if (w) {
          w.opener = null;
          e.preventDefault();
        }
      }}
    >
      Vista previa móvil
    </a>
  );
}
