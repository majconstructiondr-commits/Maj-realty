import { env } from "@/lib/env";

/**
 * Logo oficial de MAJ REALTY SRL (public/brand/, recibido de MAJ). Se muestra sin alterar;
 * solo se usan copias redimensionadas para la web. Puede sustituirse con NEXT_PUBLIC_LOGO_SRC.
 */
const SMALL = "/brand/maj-realty-logo-sm.webp";

export function BrandLogo({ variant = "header" }: { variant?: "header" | "footer" | "hero" }) {
  const custom = env.logoSrc !== "/brand/maj-realty-logo.webp";
  const src = custom ? env.logoSrc : variant === "hero" ? env.logoSrc : SMALL;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="MAJ REALTY SRL · Venta, Renta, Remodelaciones"
      className={`brand-logo brand-logo-${variant}`}
      width={variant === "hero" ? 1200 : 480}
      height={variant === "hero" ? 600 : 240}
      fetchPriority={variant === "hero" ? "high" : undefined}
      decoding="async"
    />
  );
}
