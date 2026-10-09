import Link from "next/link";
import type { SiteSettings } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import { BrandLogo } from "./BrandLogo";

export function Footer({ s }: { s: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container section">
        <div className="grid-4">
          <div className="stack">
            <Link href="/" className="footer-logo" aria-label="MAJ REALTY, ir al inicio">
              <BrandLogo variant="footer" />
            </Link>
            <p className="small">Venta, renta, administración, remodelaciones y gestiones de propiedades en República Dominicana.</p>
          </div>
          <div>
            <h3>Inmuebles</h3>
            <ul>
              <li><Link href="/venta">Venta</Link></li>
              <li><Link href="/renta">Renta</Link></li>
              <li><Link href="/busco-propiedad">Busco una propiedad</Link></li>
              <li><Link href="/publica-tu-propiedad">Publica tu propiedad</Link></li>
              <li><Link href="/calculadora-hipotecaria">Calculadora hipotecaria</Link></li>
            </ul>
          </div>
          <div>
            <h3>Servicios</h3>
            <ul>
              <li><Link href="/administracion">Administración</Link></li>
              <li><Link href="/remodelaciones">Remodelaciones</Link></li>
              <li><Link href="/cotizaciones">Cotizaciones</Link></li>
              <li><Link href="/gestiones-legales">Gestiones legales</Link></li>
              <li><Link href="/nosotros">Nosotros</Link></li>
            </ul>
          </div>
          <div>
            <h3>Contacto</h3>
            <ul>
              {s["company.phones"].map((p) => (
                <li key={p}><a href={`tel:+1${p.replace(/\D/g, "")}`}>Tel. {p}</a></li>
              ))}
              <li><a href={whatsappLink(s["whatsapp.primary"])} target="_blank" rel="noopener noreferrer">WhatsApp principal</a></li>
              <li><a href={whatsappLink(s["whatsapp.secondary"])} target="_blank" rel="noopener noreferrer">WhatsApp alternativo</a></li>
              {s["company.email"] ? <li><a href={`mailto:${s["company.email"]}`}>{s["company.email"]}</a></li> : null}
              {s["company.address"] ? <li>{s["company.address"]}</li> : null}
              {s["company.hours"] ? <li>{s["company.hours"]}</li> : null}
              <li><Link href="/contacto">Formulario de contacto</Link></li>
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
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <Link href="/legal/reclamaciones">Reclamaciones</Link>
            <Link href="/legal">Documentos legales</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
