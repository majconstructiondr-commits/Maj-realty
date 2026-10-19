import type { Metadata } from "next";
import { PanelNav } from "@/components/panel/PanelNav";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { getSellerContext } from "@/lib/listing-editor/server";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { PrivateI18nProvider } from "@/i18n/client";
import { getI18n, privateDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.panel.meta, robots: { index: false, follow: false } };
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { d } = await getI18n();
  const t = d.panel;
  if (!hasSupabase) {
    return (
      <div className="container section">
        <h1>{t.title}</h1>
        <p className="alert alert-warning">{t.demo}</p>
      </div>
    );
  }
  const u = await requireUser("/panel");
  const items = [
    { href: "/panel", label: t.nav.home },
    { href: "/panel/solicitudes", label: t.nav.requests },
    { href: "/panel/cotizaciones", label: t.nav.quotes },
    { href: "/panel/mensajes", label: t.nav.messages },
    { href: "/panel/visitas", label: t.nav.visits },
    { href: "/panel/favoritos", label: t.nav.favorites },
    { href: "/panel/busquedas", label: t.nav.searches },
  ];
  // Miembros de una agencia (añadidos por correo) no tienen el rol "agencia", pero sí membresía.
  const memberships = (await getSellerContext())?.memberships ?? [];
  if (hasRole(u, "vendedor", "agencia", "propietario") || isStaffRole(u) || memberships.length > 0) {
    items.push({ href: "/panel/publicaciones", label: t.nav.listings }, { href: "/panel/licencia", label: t.nav.license });
  } else {
    items.push({ href: "/panel/publicar", label: t.nav.publish });
  }
  if (hasRole(u, "agencia") || memberships.length > 0) items.push({ href: "/panel/organizacion", label: t.nav.agency });
  if (hasRole(u, "propietario")) items.push({ href: "/panel/administracion", label: t.nav.managed });
  const { count: tenantLeases } = await (await createClient()).from("rental_leases").select("id", { count: "exact", head: true }).eq("tenant_user_id", u.id);
  if (tenantLeases) items.push({ href: "/panel/rentas", label: t.nav.rents });
  items.push({ href: "/panel/perfil", label: t.nav.profile }, { href: "/cuenta/seguridad", label: t.nav.security });
  if (isStaffRole(u)) items.push({ href: "/admin", label: t.nav.staff });
  return (
    <PrivateI18nProvider d={privateDictionary(d)}>
      <div className="container">
        <div className="panel-layout">
          <aside>
            <p className="small muted" style={{ margin: "0 0 8px" }}>{fmt(t.hello, { name: u.fullName || u.email })}</p>
            <PanelNav items={items} label={t.title} />
            <form action="/auth/salir" method="post" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" type="submit">{t.logout}</button>
            </form>
          </aside>
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </PrivateI18nProvider>
  );
}
