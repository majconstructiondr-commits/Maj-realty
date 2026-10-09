"use client";
import { useEffect, useRef } from "react";

/** Abierto en escritorio; en móvil se cierra al cargar para que los resultados queden a la vista. */
export function FiltersPanel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(max-width: 1023px)").matches) ref.current.open = false;
  }, []);
  return (
    <details ref={ref} className="card filters" open>
      {children}
    </details>
  );
}
