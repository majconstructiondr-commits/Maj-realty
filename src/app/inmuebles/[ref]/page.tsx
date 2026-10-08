import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getListingByCode, latestExchangeRate } from "@/lib/catalog/data";
import {
  CONDITIONS, FEATURES, NUMERIC_FIELDS, PROPERTY_TYPES, SPACE_FIELDS, fieldApplies,
  type NumericField, type SpaceField,
} from "@/lib/catalog/definitions";
import type { CatalogPrice } from "@/lib/catalog/types";
import { convert, formatDate, formatMoney, formatNumber, type Currency } from "@/lib/format";
import { getSiteSettings } from "@/lib/site";
import { fillTemplate } from "@/lib/whatsapp";
import { env, hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Gallery } from "@/components/property/Gallery";
import { FactBox, TriBox } from "@/components/property/FactBox";
import { ShareButton } from "@/components/property/ShareButton";
import { FavoriteButton } from "@/components/property/FavoriteButton";
import { ReportForm } from "@/components/property/ReportForm";
import { ApproxMap } from "@/components/property/ApproxMap";
import { listingHref } from "@/components/property/ListingCard";
import { WhatsAppLink } from "@/components/ui/WhatsAppLink";
import { RequestForm } from "@/components/forms/RequestForm";
import { Icon } from "@/components/ui/Icon";
import { TrackView } from "@/components/property/TrackView";

function codeFromRef(ref: string) {
  const m = /^([a-z]+-\d{4,})/i.exec(ref);
  return m ? m[1].toUpperCase() : null;
}

export async function generateMetadata(props: PageProps<"/inmuebles/[ref]">): Promise<Metadata> {
  const { ref } = await props.params;
  const code = codeFromRef(ref);
  const data = code ? await getListingByCode(code) : null;
  if (!data) return { title: "Inmueble no encontrado", robots: { index: false } };
  const l = data.listing;
  const price = l.sale_currency ? formatMoney(l.sale_price, l.sale_currency) : l.rent_currency ? formatMoney(l.rent_price, l.rent_currency) : "";
  return {
    title: `${l.title} (${l.code})`,
    description: `${PROPERTY_TYPES[l.property_type]} en ${[l.sector, l.municipality, l.province].filter(Boolean).join(", ")}. ${price}`.slice(0, 160),
    alternates: { canonical: listingHref(l) },
    robots: l.is_demo ? { index: false, follow: false } : undefined,
    openGraph: { title: l.title, type: "website", url: listingHref(l) },
  };
}

function PriceSection({ p, rate }: { p: CatalogPrice; rate: Awaited<ReturnType<typeof latestExchangeRate>> }) {
  const amount = p.amount ? Number(p.amount) : null;
  const conv = amount !== null && rate ? convert(amount, { base: rate.base, quote: rate.quote, rate: Number(rate.rate) }, p.currency) : null;
  return (
    <section className="card card-body" aria-labelledby={`precio-${p.operation}`}>
      <h3 id={`precio-${p.operation}`}>{p.operation === "venta" ? "Precio de venta" : "Precio de renta"}</h3>
      <div className="facts">
        <FactBox label="Importe" value={p.amount ? formatMoney(p.amount, p.currency) + (p.operation === "renta" && p.rent_period ? ` / ${p.rent_period}` : "") : "Precio a consultar"} />
        <FactBox label="Moneda" value={p.currency === "USD" ? "Dólares (US$)" : "Pesos dominicanos (RD$)"} />
        <FactBox label="Negociable" value={p.negotiable ? "Sí" : "No"} />
        <FactBox label="Mantenimiento" value={p.maintenance_amount && p.maintenance_currency ? formatMoney(p.maintenance_amount, p.maintenance_currency) : null} />
        <FactBox label="Mantenimiento incluido" value={p.maintenance_included === "si" ? "Sí" : p.maintenance_included === "no" ? "No" : null} na={p.maintenance_included === "no_aplica"} />
        {p.operation === "renta" ? (
          <>
            <FactBox label="Depósito" value={p.deposit_amount ? formatMoney(p.deposit_amount, p.currency) : p.deposit_months ? `${formatNumber(p.deposit_months, 1)} mes(es)` : null} />
            <FactBox label="Adelanto" value={p.advance_months ? `${formatNumber(p.advance_months, 1)} mes(es)` : null} />
            <FactBox label="Plazo mínimo" value={p.min_term_months !== null ? `${p.min_term_months} meses` : null} />
          </>
        ) : null}
      </div>
      {p.additional_costs ? <p className="small" style={{ marginTop: 10 }}><strong>Gastos adicionales:</strong> {p.additional_costs}</p> : null}
      {p.delivery_conditions ? <p className="small"><strong>Condiciones de entrega:</strong> {p.delivery_conditions}</p> : null}
      {conv && rate ? (
        <p className="xs muted" style={{ marginTop: 8 }}>
          Referencia orientativa: ≈ {formatMoney(Math.round(conv.amount), conv.currency as Currency)} con tasa {formatNumber(rate.rate, 4)} ({rate.base}→{rate.quote}), fuente: {rate.source}, del {formatDate(rate.rate_date)}. El precio válido es el indicado en {p.currency}.
        </p>
      ) : null}
    </section>
  );
}

export default async function ListingPage(props: PageProps<"/inmuebles/[ref]">) {
  const { ref } = await props.params;
  const sp = await props.searchParams;
  const code = codeFromRef(ref);
  if (!code) notFound();
  const data = await getListingByCode(code);
  if (!data) notFound();
  const { listing: l, prices, media, demo } = data;
  const canonical = listingHref(l).slice("/inmuebles/".length);
  if (ref.toLowerCase() !== canonical) permanentRedirect(listingHref(l));

  const [s, rate, user] = await Promise.all([getSiteSettings(), latestExchangeRate(), getSessionUser()]);
  let isFav = false;
  if (user && hasSupabase) {
    const supabase = await createClient();
    const { data: f } = await supabase.from("favorites").select("property_id").eq("property_id", l.id).maybeSingle();
    isFav = Boolean(f);
  }
  const url = `${env.siteUrl}${listingHref(l)}`;
  const waNumber = s["whatsapp.routing"] === "asesor" && l.advisor_whatsapp ? l.advisor_whatsapp : s["whatsapp.primary"];
  const waText = fillTemplate(s["whatsapp.template"], { servicio: `el inmueble "${l.title}"`, codigo: l.code, url });
  const volver = typeof sp.volver === "string" && /^\/(venta|renta)(\?|$)/.test(sp.volver) ? sp.volver : `/${l.operation === "renta" ? "renta" : "venta"}`;
  const na = new Set(l.na_fields);
  const featureEntries = Object.entries(FEATURES).map(([k, d]) => ({ k, d, v: l.features[k] }));
  const own = featureEntries.filter((f) => f.d.scope === "inmueble" && f.v);
  const condo = featureEntries.filter((f) => f.d.scope === "residencial" && f.v);
  const tours = media.filter((m) => m.kind === "video" || m.kind === "recorrido");

  const jsonLd = demo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name: l.title,
        url,
        datePosted: l.published_at ?? undefined,
        dateModified: l.updated_at,
        description: l.description.slice(0, 500),
        offers: prices
          .filter((p) => p.amount)
          .map((p) => ({ "@type": "Offer", price: Number(p.amount), priceCurrency: p.currency, businessFunction: p.operation === "venta" ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut" })),
      };

  return (
    <div className="container section-sm">
      <TrackView propertyId={l.id} />
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      <nav aria-label="Ruta" className="small" style={{ marginBottom: 10 }}>
        <Link href={volver}>← Volver a los resultados</Link>
      </nav>
      {demo ? <p className="alert alert-warning small">Publicación de demostración: no es un inmueble real.</p> : null}

      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <span className="eyebrow">{PROPERTY_TYPES[l.property_type]} · Ref. {l.code}</span>
          <h1 style={{ marginBottom: 6 }}>{l.title}</h1>
          <p className="muted row" style={{ gap: 6, margin: 0 }}>
            <Icon name="pin" size={16} /> {[l.sector, l.municipality, l.province].filter(Boolean).join(", ")} (ubicación aproximada)
          </p>
        </div>
        <div className="row">
          {l.status === "reservado" ? <span className="badge badge-warning">Reservado</span> : null}
          {l.condition ? <span className="badge">{CONDITIONS[l.condition as keyof typeof CONDITIONS]}</span> : null}
        </div>
      </div>

      <div className="detail-layout" style={{ marginTop: 18 }}>
        <div className="stack" style={{ display: "grid", gap: 20 }}>
          <Gallery media={media} title={l.title} demo={demo} />

          <div className="mobile-only card card-body">
            {l.sale_currency ? <div className="listing-price">{formatMoney(l.sale_price, l.sale_currency)} <small>venta</small></div> : null}
            {l.rent_currency ? <div className="listing-price">{formatMoney(l.rent_price, l.rent_currency)} <small>/ {l.rent_period === "mensual" ? "mes" : l.rent_period} renta</small></div> : null}
            <div className="action-list" style={{ marginTop: 10 }}>
              <WhatsAppLink number={waNumber} text={waText} propertyId={demo ? undefined : l.id} className="btn btn-whatsapp btn-block" />
              <a className="btn btn-ghost btn-block" href="#acciones">Más opciones: chat, visita, información</a>
            </div>
          </div>

          {prices.map((p) => (
            <PriceSection key={p.operation} p={p} rate={rate} />
          ))}

          <section className="card card-body" aria-labelledby="dist">
            <h3 id="dist">Dimensiones y distribución</h3>
            <div className="facts">
              {(Object.keys(NUMERIC_FIELDS) as NumericField[]).map((k) => {
                const applies = fieldApplies(l.property_type, k) && !na.has(k);
                if (!applies && l[k] === null) return <FactBox key={k} label={NUMERIC_FIELDS[k].label} value={null} na />;
                return <FactBox key={k} label={NUMERIC_FIELDS[k].label} value={l[k]} unit={NUMERIC_FIELDS[k].unit} />;
              })}
            </div>
            <h3 style={{ marginTop: 18 }}>Espacios</h3>
            <div className="facts">
              {(Object.keys(SPACE_FIELDS) as SpaceField[]).map((k) => (
                <TriBox key={k} label={SPACE_FIELDS[k]} value={!fieldApplies(l.property_type, k) && l[k] === "desconocido" ? "no_aplica" : l[k]} detail={k === "roof_area" ? l.roof_use_detail : null} />
              ))}
            </div>
          </section>

          {own.length || condo.length ? (
            <section className="card card-body" aria-labelledby="car">
              <h3 id="car">Características</h3>
              {own.length ? (
                <>
                  <p className="small muted" style={{ margin: "6px 0" }}>Del inmueble</p>
                  <div className="facts">
                    {own.map((f) => <TriBox key={f.k} label={f.d.label} value={f.v!.v} detail={f.v!.d} />)}
                  </div>
                </>
              ) : null}
              {condo.length ? (
                <>
                  <p className="small muted" style={{ margin: "14px 0 6px" }}>Del residencial o edificio</p>
                  <div className="facts">
                    {condo.map((f) => <TriBox key={f.k} label={f.d.label} value={f.v!.v} detail={f.v!.d} />)}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="card card-body" aria-labelledby="desc">
            <h3 id="desc">Descripción</h3>
            <div style={{ whiteSpace: "pre-line" }}>{l.description}</div>
            {l.condo_rules ? (<><h3 style={{ marginTop: 16 }}>Reglas del condominio</h3><p style={{ whiteSpace: "pre-line" }}>{l.condo_rules}</p></>) : null}
            {l.restrictions ? (<><h3>Restricciones</h3><p style={{ whiteSpace: "pre-line" }}>{l.restrictions}</p></>) : null}
            <div className="facts" style={{ marginTop: 12 }}>
              <FactBox label="Disponible desde" value={l.available_from ? formatDate(l.available_from) : null} />
              <FactBox label="Última actualización" value={formatDate(l.updated_at)} />
            </div>
          </section>

          {tours.length ? (
            <section className="card card-body">
              <h3>Video y recorrido virtual</h3>
              <ul>
                {tours.map((m) => (
                  <li key={m.id}><a href={m.external_url!} target="_blank" rel="noopener noreferrer">{m.kind === "video" ? "Ver video" : "Ver recorrido virtual"}{m.alt_text ? `: ${m.alt_text}` : ""}</a></li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card card-body" aria-labelledby="ubic">
            <h3 id="ubic">Ubicación</h3>
            <div className="facts">
              <FactBox label="Provincia" value={l.province} />
              <FactBox label="Municipio" value={l.municipality} />
              <FactBox label="Sector" value={l.sector} />
              {l.public_address ? <FactBox label="Dirección (autorizada por el propietario)" value={l.public_address} /> : null}
            </div>
            {l.approx_lat && l.approx_lng ? (
              <div style={{ marginTop: 12 }}>
                <ApproxMap lat={Number(l.approx_lat)} lng={Number(l.approx_lng)} />
              </div>
            ) : null}
            <p className="xs muted" style={{ marginTop: 8 }}>Se muestra una zona aproximada. La dirección exacta se comparte con interesados según la autorización del propietario.</p>
          </section>

          <section className="card card-body" aria-labelledby="verif">
            <h3 id="verif">Información y verificación</h3>
            {l.documents_reviewed_at ? (
              <p>
                <span className="badge badge-success"><Icon name="check" size={14} /> Documentos revisados el {formatDate(l.documents_reviewed_at)}</span>
                {l.documents_review_scope ? <span className="small muted" style={{ display: "block", marginTop: 6 }}>Alcance: {l.documents_review_scope}</span> : null}
              </p>
            ) : (
              <p className="small">MAJ aún no ha registrado una revisión documental de este inmueble.</p>
            )}
            <p className="xs muted" style={{ margin: 0 }}>
              Los datos de la publicación son declarados por el anunciante. Una cuenta aprobada no implica que el inmueble esté jurídicamente verificado. La revisión documental, cuando existe, se limita al alcance indicado y no garantiza la ausencia de cargas o gravámenes.
            </p>
          </section>
        </div>

        <aside>
          <div className="sticky-aside stack" id="acciones" style={{ display: "grid", gap: 14 }}>
            <div className="card card-body">
              {l.sale_currency ? <div className="listing-price">{formatMoney(l.sale_price, l.sale_currency)} <small>venta</small></div> : null}
              {l.rent_currency ? <div className="listing-price">{formatMoney(l.rent_price, l.rent_currency)} <small>/ {l.rent_period === "mensual" ? "mes" : l.rent_period} renta</small></div> : null}
              <div className="action-list" style={{ marginTop: 12 }}>
                <WhatsAppLink number={waNumber} text={waText} propertyId={demo ? undefined : l.id} className="btn btn-whatsapp btn-block" />
                <Link className="btn btn-primary btn-block" href={`/panel/mensajes/nuevo?inmueble=${l.code}`}>
                  <Icon name="chat" size={18} /> Escribir dentro de la página
                </Link>
                <Link className="btn btn-outline btn-block" href={`/panel/visitas/nueva?inmueble=${l.code}`}>
                  <Icon name="calendar" size={18} /> Agendar visita
                </Link>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <ShareButton url={url} title={l.title} />
                  {!demo ? <FavoriteButton propertyId={l.id} initial={isFav} /> : null}
                </div>
              </div>
              <p className="xs muted" style={{ marginTop: 10 }}>El chat y la agenda requieren una cuenta gratuita. WhatsApp y el formulario no.</p>
            </div>
            <div className="card card-body" id="informacion">
              <h3>Solicitar información</h3>
              <RequestForm kind="info_inmueble" propertyId={demo ? undefined : l.id} propertyRef={l.code} compact messageLabel="¿Qué le gustaría saber?" submitLabel="Solicitar información" defaultEmail={user?.email} defaultName={user?.fullName} />
            </div>
            {!demo ? <ReportForm propertyId={l.id} /> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
