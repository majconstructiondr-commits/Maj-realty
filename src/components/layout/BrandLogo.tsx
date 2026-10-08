import { env } from "@/lib/env";

/**
 * Logo aprobado de MAJ REALTY. Mientras no se reciba el archivo oficial se muestra un espacio
 * identificado "LOGO PENDIENTE" (no se inventa un logo). Para activarlo: copiar el archivo a
 * public/brand/ y definir NEXT_PUBLIC_LOGO_SRC=/brand/<archivo>.
 */
export function BrandLogo({ showName = true }: { showName?: boolean }) {
  return (
    <>
      {env.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={env.logoSrc} alt="MAJ REALTY SRL" height={48} style={{ height: 48, width: "auto" }} />
      ) : (
        <span className="logo-placeholder" role="img" aria-label="Espacio reservado para el logo oficial (pendiente)">
          LOGO
          <br />
          PENDIENTE
        </span>
      )}
      {showName && !env.logoSrc ? (
        <span className="brand-name">
          MAJ REALTY
          <small>SRL · BIENES RAÍCES</small>
        </span>
      ) : null}
    </>
  );
}
