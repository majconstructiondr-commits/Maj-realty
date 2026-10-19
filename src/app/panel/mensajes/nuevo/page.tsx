import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listingHref } from "@/components/property/ListingCard";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { NewConversationForm } from "./NewConversationForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.newConversation.meta };
}

export default async function Page(props: PageProps<"/panel/mensajes/nuevo">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.inmueble) ? sp.inmueble[0] : sp.inmueble;
  const code = typeof raw === "string" && /^[A-Za-z]+-\d{4,}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;
  await requireUser(`/panel/mensajes/nuevo${code ? `?inmueble=${code}` : ""}`);
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.newConversation;
  const { data: p } = code ? await supabase.from("catalog").select("id, code, slug, title, sector, municipality").eq("code", code).maybeSingle() : { data: null };

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted">
        <Link href="/panel/mensajes">{d.panel.messages.title}</Link> / <span aria-current="page">{t.breadcrumb}</span>
      </nav>
      <h1>{t.title}</h1>
      {!p ? (
        <div className="card empty">
          <p>{code ? d.panel.shared.notAvailable : t.pick}</p>
          <Link className="btn btn-primary" href="/venta">{d.panel.shared.viewProperties}</Link>
        </div>
      ) : (
        <section className="card card-body">
          <p style={{ marginTop: 0 }}>
            {d.panel.shared.propertyLabel} <Link href={listingHref(p)}>{p.title}</Link> <span className="muted">({p.code}{p.sector ? ` · ${p.sector}` : ""})</span>
          </p>
          <p className="xs muted">{t.note}</p>
          <NewConversationForm propertyId={p.id} defaultSubject={fmt(t.defaultSubject, { code: p.code })} />
        </section>
      )}
    </div>
  );
}
