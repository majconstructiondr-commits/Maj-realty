import { Fragment } from "react";
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
import { getI18n } from "@/i18n/server";

const HERO_LINES = [
  { key: "residential", icon: "home" },
  { key: "commercial", icon: "building" },
  { key: "remodeling", icon: "helmet" },
  { key: "investment", icon: "invest" },
] as const;

export default async function HomePage() {
  const [{ items, demo }, s, team, { d }] = await Promise.all([featuredListings(6), getSiteSettings(), getTeam(), getI18n()]);
  const h = d.home;
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-logo">
              <BrandLogo variant="hero" alt={d.header.logoAlt} />
            </div>
            <div>
              <p className="hero-tagline">
                {h.tagline.map((x, i) => (
                  <Fragment key={x}>{i > 0 ? <span aria-hidden="true">|</span> : null}{x}</Fragment>
                ))}
              </p>
              <h1>{h.title}</h1>
              <p className="lead">{h.lead}</p>
              <ul className="hero-lines" aria-label={h.linesAria}>
                {HERO_LINES.map((x) => (
                  <li key={x.key}>
                    <span className="line-icon"><Icon name={x.icon} size={20} /></span>
                    {h.lines[x.key]}
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
              <span className="eyebrow">{h.listingsEyebrow}</span>
              <h2>{h.listingsTitle}</h2>
            </div>
            <div className="row">
              <Link className="btn btn-outline btn-sm" href="/venta">{h.seeSale}</Link>
              <Link className="btn btn-outline btn-sm" href="/renta">{h.seeRent}</Link>
            </div>
          </div>
          {demo ? <p className="alert alert-warning small" style={{ marginTop: 12 }}>{h.demoNotice}</p> : null}
          {items.length ? (
            <div className="grid-3" style={{ marginTop: 20 }}>
              {items.map((l) => (
                <ListingCard key={l.id} l={l} d={d} />
              ))}
            </div>
          ) : (
            <div className="card empty" style={{ marginTop: 20 }}>
              <p>{h.empty}</p>
              <Link className="btn btn-primary" href="/busco-propiedad">{d.common.lookingForProperty}</Link>
            </div>
          )}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <span className="eyebrow">{h.servicesEyebrow}</span>
          <h2>{h.servicesTitle}</h2>
          <hr className="gold-rule" />
          <div className="grid-3">
            {SERVICES.map((sv) => (
              <Link key={sv.href} href={sv.href} className="card service-card" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="service-icon"><Icon name={sv.icon} size={24} /></span>
                <h3 style={{ margin: 0 }}>{d.services[sv.key].title}</h3>
                <p className="muted small" style={{ margin: 0 }}>{d.services[sv.key].text}</p>
                <span className="small" style={{ color: "var(--gold-600)", fontWeight: 700, marginTop: "auto" }}>{d.common.seeMore}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <span className="eyebrow">{h.processEyebrow}</span>
          <h2>{h.processTitle}</h2>
          <hr className="gold-rule" />
          <ol className="steps">
            {h.steps.map((st) => (
              <li key={st.h} className="card"><h3>{st.h}</h3><p className="small muted">{st.p}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {team.length ? (
        <section className="section section-alt">
          <div className="container">
            <span className="eyebrow">{h.teamEyebrow}</span>
            <h2>{h.teamTitle}</h2>
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
                <h2 style={{ color: "#fff", marginBottom: 6 }}>{h.ctaTitle}</h2>
                <p style={{ color: "#dfe4ec", margin: 0 }}>{h.ctaText}</p>
              </div>
              <Link href="/busco-propiedad" className="btn btn-gold">{d.common.lookingForProperty}</Link>
            </div>
          </div>
          <div style={{ marginTop: 24 }}>
            <ContactButtons s={s} d={d} servicio="sus servicios" />
          </div>
        </div>
      </section>
    </>
  );
}
