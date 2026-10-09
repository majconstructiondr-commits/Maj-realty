import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCreateListings, getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { NewDraftForm } from "@/components/listing-editor/NewDraftForm";

export const metadata: Metadata = { title: "Nueva publicación", robots: { index: false, follow: false } };

export default async function NewListingPage() {
  await requireUser("/panel/publicaciones/nueva");
  const ctx = (await getSellerContext())!;
  const orgs = ctx.memberships
    .filter((m) => memberCan(m, "publish") && m.organization)
    .map((m) => ({ id: m.organization_id, name: m.organization!.name }));
  return (
    <div className="section-sm">
      <nav aria-label="Ruta" className="small" style={{ marginBottom: 8 }}>
        <Link href="/panel/publicaciones">← Mis publicaciones</Link>
      </nav>
      <h1>Nueva publicación</h1>
      {canCreateListings(ctx) ? (
        <>
          <p className="muted">
            Empiece con lo básico. Se crea un borrador privado que puede completar por pasos (ubicación, precios, distribución, fotos y documentos) y enviar a revisión cuando esté listo.
          </p>
          <NewDraftForm orgs={orgs} />
        </>
      ) : (
        <p className="alert alert-info">
          Su cuenta aún no está habilitada para publicar. <Link href="/panel/publicar">Solicite su licencia de publicación</Link>.
        </p>
      )}
    </div>
  );
}
