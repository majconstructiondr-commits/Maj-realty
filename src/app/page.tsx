import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { HeroSearch } from "@/components/property/HeroSearch";
import { ListingCard } from "@/components/property/ListingCard";
import { ContactButtons } from "@/components/ui/ContactButtons";
import { Icon } from "@/components/ui/Icon";
import { featuredListings } from "@/lib/catalog/data";
import { getSiteSettings } from "@/lib/site";
import { SERVICES } from "@/lib/services";
import { getTeam } from "@/lib/team";

const HERO_LINES = [
  { label: "Residencial", icon: "home" },
  { label: "Comercial", icon: "building" },
  { label: "Remodelaciones", icon: "helmet" },
  { label: "Inversión", icon: "invest" },
] as const;

export default async function HomePage() {
  const [{ items, demo }, s, team] = await Promise.all([featuredListings(6), getSiteSettings(), getTeam()]);
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-logo">
              <BrandLogo variant="hero" />
            </div>
            <div>
              <p className="hero-tagline">
                Venta<span aria-hidden="true">|</span>Renta<span aria-hidden="true">|</span>Remodelaciones
              </p>
              <h1>Encuentra, vende o administra tu propiedad con confianza</h1>
              <p className="lead">Venta, renta, administración, remodelaciones, cotizaciones y gestiones de propiedades en República Dominicana, con información clara en cada paso.</p>
              <ul className="hero-lines" aria-label="Áreas de trabajo">
                {HERO_LINES.map((x) => (
                  <li key={x.label}>
                    <span className="line-icon"><Icon name={x.icon} size={20} /></span>
                    {x.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <HeroSearch />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row-between">
            <div>
              <span className="eyebrow">Propiedades publicadas</span>
              <h2>Inmuebles disponibles</h2>
            </div>
            <div className="row">
              <Link className="btn btn-outline btn-sm" href="/venta">Ver en venta</Link>
              <Link className="btn btn-outline btn-sm" href="/renta">Ver en renta</Link>
            </div>
          </div>
          {demo ? <p className="alert alert-warning small" style={{ marginTop: 12 }}>Ejemplos de demostración: no son inmuebles reales.</p> : null}
          {items.length ? (
            <div className="grid-3" style={{ marginTop: 20 }}>
              {items.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          ) : (
            <div className="card empty" style={{ marginTop: 20 }}>
              <p>Aún no hay inmuebles publicados. Cuéntanos qué buscas y te avisamos.</p>
              <Link className="btn btn-primary" href="/busco-propiedad">Busco una propiedad</Link>
            </div>
          )}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <span className="eyebrow">Servicios</span>
          <h2>Todo lo que tu propiedad necesita</h2>
          <hr className="gold-rule" />
          <div className="grid-3">
            {SERVICES.map((sv) => (
              <Link key={sv.href} href={sv.href} className="card service-card" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="service-icon"><Icon name={sv.icon} size={24} /></span>
                <h3 style={{ margin: 0 }}>{sv.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>{sv.text}</p>
                <span className="small" style={{ color: "var(--gold-600)", fontWeight: 700, marginTop: "auto" }}>Ver más →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">Cómo trabajamos</span>
          <h2>Un proceso claro y con registro</h2>
          <hr className="gold-rule" />
          <ol className="steps">
            <li className="card"><h3>Solicitud</h3><p className="small muted">Nos escribes por la página o WhatsApp. Cada solicitud recibe un número de seguimiento.</p></li>
            <li className="card"><h3>Evaluación</h3><p className="small muted">Un asesor revisa tu caso, coordina visitas y solicita solo la documentación necesaria.</p></li>
            <li className="card"><h3>Propuesta</h3><p className="small muted">Recibes información o una cotización con alcance, vigencia y condiciones por escrito.</p></li>
            <li className="card"><h3>Seguimiento</h3><p className="small muted">Consultas el estado desde tu cuenta, con historial de cada paso.</p></li>
          </ol>
        </div>
      </section>

      {team.length ? (
        <section className="section section-alt">
          <div className="container">
            <span className="eyebrow">Equipo</span>
            <h2>Nuestros asesores</h2>
            <div className="grid-4" style={{ marginTop: 16 }}>
              {team.map((m) => (
                <div key={m.id} className="card card-body center">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.display_name} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px" }} />
                  ) : null}
                  <strong>{m.display_name}</strong>
                  {m.title ? <p className="small muted">{m.title}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="container">
          <div className="card card-body" style={{ background: "var(--navy-800)", color: "#fff" }}>
            <div className="row-between">
              <div>
                <h2 style={{ color: "#fff", marginBottom: 6 }}>¿No encuentras lo que buscas?</h2>
                <p style={{ color: "#dfe4ec", margin: 0 }}>Déjanos tus criterios y te contactamos cuando tengamos opciones.</p>
              </div>
              <Link href="/busco-propiedad" className="btn btn-gold">Busco una propiedad</Link>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <ContactButtons s={s} servicio="sus servicios" />
          </div>
        </div>
      </section>
    </>
  );
}
