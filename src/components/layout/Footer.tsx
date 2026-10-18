import Link from "next/link";
import type { SiteSettings } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import type { Dictionary } from "@/i18n/es";
import { BrandLogo } from "./BrandLogo";

export function Footer({ s, d }: { s: SiteSettings; d: Dictionary }) {
  const f = d.footer;
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container section">
        <div className="grid-4">
          <div className="stack">
            <Link href="/" className="footer-logo" aria-label={d.header.homeAria}>
              <BrandLogo variant="footer" alt={d.header.logoAlt} />
            </Link>
            <p className="small">{f.tagline}</p>
          </div>
          <div>
            <h3>{f.properties}</h3>
            <ul>
              <li><Link href="/venta">{d.nav.sale}</Link></li>
              <li><Link href="/renta">{d.nav.rent}</Link></li>
              <li><Link href="/busco-propiedad">{f.lookingFor}</Link></li>
              <li><Link href="/publica-tu-propiedad">{f.publish}</Link></li>
              <li><Link href="/calculadora-hipotecaria">{f.mortgage}</Link></li>
              <li><Link href="/app">{f.app}</Link></li>
            </ul>
          </div>
          <div>
            <h3>{f.services}</h3>
            <ul>
              <li><Link href="/administracion">{d.nav.management}</Link></li>
              <li><Link href="/remodelaciones">{d.nav.remodeling}</Link></li>
              <li><Link href="/cotizaciones">{d.nav.quotes}</Link></li>
              <li><Link href="/gestiones-legales">{d.nav.legal}</Link></li>
              <li><Link href="/nosotros">{d.nav.about}</Link></li>
            </ul>
          </div>
          <div>
            <h3>{f.contact}</h3>
            <ul>
              {s["company.phones"].map((p) => (
                <li key={p}><a href={`tel:+1${p.replace(/\D/g, "")}`}>{f.phone} {p}</a></li>
              ))}
              <li><a href={whatsappLink(s["whatsapp.primary"])} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
              {s["whatsapp.secondary"] ? <li><a href={whatsappLink(s["whatsapp.secondary"])} target="_blank" rel="noopener noreferrer">{f.whatsappAlt}</a></li> : null}
              {s["company.email"] ? <li><a href={`mailto:${s["company.email"]}`}>{s["company.email"]}</a></li> : null}
              {s["company.address"] ? <li>{s["company.address"]}</li> : null}
              {s["company.hours"] ? <li>{s["company.hours"]}</li> : null}
              <li><Link href="/contacto">{f.contactForm}</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <div className="row-between">
          <span>
            © {year} {s["company.name"]}
            {s["company.rnc"] ? ` · RNC ${s["company.rnc"]}` : ""}
          </span>
          <span className="row" style={{ gap: 14 }}>
            <Link href="/legal/privacidad">{f.privacy}</Link>
            <Link href="/legal/terminos">{f.terms}</Link>
            <Link href="/legal/cookies">{f.cookies}</Link>
            <Link href="/legal/reclamaciones">{f.complaints}</Link>
            <Link href="/legal">{f.legalDocs}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
