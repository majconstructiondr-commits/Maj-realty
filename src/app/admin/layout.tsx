import type { Metadata } from "next";
import { PanelNav } from "@/components/panel/PanelNav";
import { hasRole, requireStaff } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { fmt } from "@/i18n";
import { PrivateI18nProvider } from "@/i18n/client";
import { getI18n, privateDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.admin.layout.title, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { d } = await getI18n();
  const t = d.admin.layout;
  if (!hasSupabase) {
    return (
      <div className="container section">
        <h1>{t.title}</h1>
        <p className="alert alert-warning">{t.demo}</p>
      </div>
    );
  }
  const u = await requireStaff("/admin");
  const n = t.nav;
  const items = [
    { href: "/admin", label: n.dashboard },
    { href: "/admin/inmuebles", label: n.listings },
    { href: "/admin/solicitudes", label: n.requests },
    { href: "/admin/visitas", label: n.visits },
    { href: "/admin/mensajes", label: n.conversations },
    { href: "/admin/cotizaciones", label: n.quotes },
    { href: "/admin/administracion", label: n.management },
    { href: "/admin/rentas", label: n.rents },
    { href: "/admin/licencias", label: n.licenses },
    { href: "/admin/publicadores", label: n.publishers },
    { href: "/admin/usuarios", label: n.users },
    { href: "/admin/reportes", label: n.reports },
    { href: "/admin/contenido", label: n.content },
    { href: "/admin/auditoria", label: n.audit },
  ];
  if (hasRole(u, "admin")) items.push({ href: "/admin/configuracion", label: n.settings }, { href: "/admin/planes", label: n.plans });
  return (
    <PrivateI18nProvider d={privateDictionary(d)}>
      <div className="container">
        <div className="panel-layout">
          <aside>
            <p className="small muted" style={{ margin: "0 0 8px" }}>{fmt(t.staff, { name: u.fullName || u.email })}</p>
            <PanelNav items={items} label={t.title} />
          </aside>
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </PrivateI18nProvider>
  );
}
