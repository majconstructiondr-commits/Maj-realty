"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { mainNav } from "./nav";
import { useI18n } from "@/i18n/client";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Icon } from "../ui/Icon";

export function Header({ logo, signedIn }: { logo: React.ReactNode; signedIn: boolean }) {
  const pathname = usePathname();
  const { d } = useI18n();
  const [open, setOpen] = useState(false);
  // Cerrar el menú al cambiar de página (ajuste durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <header className="site-header">
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label={d.header.homeAria}>
            {logo}
          </Link>
          <nav className="nav-desktop" aria-label={d.header.mainNav}>
            {mainNav.slice(1).map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {d.nav[item.key]}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <LanguageSwitcher />
            <Link href={signedIn ? "/panel" : "/cuenta/ingresar"} className="account-link">
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <Icon name="user" size={16} /> <span className="account-text">{d.nav.account}</span>
              </span>
            </Link>
            <button
              type="button"
              className="menu-btn"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? d.header.closeMenu : d.header.openMenu}</span>
              <Icon name="menu" />
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-nav" className="mobile-nav" aria-label={d.header.mobileNav}>
            {mainNav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {d.nav[item.key]}
              </Link>
            ))}
            <Link href={signedIn ? "/panel" : "/cuenta/ingresar"}>{d.nav.account}</Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
