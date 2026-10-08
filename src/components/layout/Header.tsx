"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { mainNav } from "./nav";
import { t } from "@/i18n";
import { Icon } from "../ui/Icon";

export function Header({ logo, signedIn }: { logo: React.ReactNode; signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <header className="site-header">
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label="MAJ REALTY, ir al inicio">
            {logo}
          </Link>
          <nav className="nav-desktop" aria-label="Principal">
            {mainNav.slice(1).map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link href={signedIn ? "/panel" : "/cuenta/ingresar"} className="account-link">
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <Icon name="user" size={16} /> {t.nav.account}
              </span>
            </Link>
            <button
              type="button"
              className="menu-btn"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
              <Icon name="menu" />
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-nav" className="mobile-nav" aria-label="Principal (móvil)">
            {mainNav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {item.label}
              </Link>
            ))}
            <Link href={signedIn ? "/panel" : "/cuenta/ingresar"}>{t.nav.account}</Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
