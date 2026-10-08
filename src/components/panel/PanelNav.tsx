"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  const current = items
    .filter((i) => path === i.href || path.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="panel-nav" aria-label={label}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.href === current ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
