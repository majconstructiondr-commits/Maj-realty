import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { NewConversationForm } from "./NewConversationForm";

export const metadata: Metadata = { title: "Nueva conversación" };

export default async function Page(props: PageProps<"/panel/mensajes/nuevo">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.inmueble) ? sp.inmueble[0] : sp.inmueble;
  const code = typeof raw === "string" && /^[A-Za-z]+-\d{4,}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;
  await requireUser(`/panel/mensajes/nuevo${code ? `?inmueble=${code}` : ""}`);
  const supabase = await createClient();
  const { data: p } = code ? await supabase.from("catalog").select("id, code, slug, title, sector, municipality").eq("code", code).maybeSingle() : { data: null };

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label="Ruta" className="small muted">
        <Link href="/panel/mensajes">Mensajes</Link> / <span aria-current="page">Nueva conversación</span>
      </nav>
      <h1>Escribir sobre un inmueble</h1>
      {!p ? (
        <div className="card empty">
          <p>{code ? "Ese inmueble no está disponible o el código no existe." : "Indique desde la ficha de un inmueble sobre cuál desea escribir."}</p>
          <Link className="btn btn-primary" href="/venta">Ver inmuebles</Link>
        </div>
      ) : (
        <section className="card card-body">
          <p style={{ marginTop: 0 }}>
            Inmueble: <Link href={listingHref(p)}>{p.title}</Link> <span className="muted">({p.code}{p.sector ? ` · ${p.sector}` : ""})</span>
          </p>
          <p className="xs muted">El mensaje llega al asesor o publicador del inmueble por el chat interno de la página (no por WhatsApp).</p>
          <NewConversationForm propertyId={p.id} defaultSubject={`Consulta sobre ${p.code}`} />
        </section>
      )}
    </div>
  );
}
