import type { Metadata } from "next";
import { PanelNav } from "@/components/panel/PanelNav";
import { hasRole, requireStaff } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";

export const metadata: Metadata = { title: "Panel MAJ", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase) {
    return (
      <div className="container section">
        <h1>Panel MAJ</h1>
        <p className="alert alert-warning">Modo demostración: configure la base de datos para usar el panel administrativo.</p>
      </div>
    );
  }
  const u = await requireStaff("/admin");
  const items = [
    { href: "/admin", label: "Tablero" },
    { href: "/admin/inmuebles", label: "Inmuebles y revisión" },
    { href: "/admin/solicitudes", label: "Solicitudes y CRM" },
    { href: "/admin/visitas", label: "Visitas" },
    { href: "/admin/mensajes", label: "Conversaciones" },
    { href: "/admin/cotizaciones", label: "Cotizaciones" },
    { href: "/admin/administracion", label: "Administración de propiedades" },
    { href: "/admin/licencias", label: "Licencias y pagos" },
    { href: "/admin/publicadores", label: "Solicitudes de publicador" },
    { href: "/admin/usuarios", label: "Usuarios y agencias" },
    { href: "/admin/reportes", label: "Reportes y moderación" },
    { href: "/admin/contenido", label: "Contenido y portafolio" },
    { href: "/admin/auditoria", label: "Auditoría" },
  ];
  if (hasRole(u, "admin")) items.push({ href: "/admin/configuracion", label: "Configuración" }, { href: "/admin/planes", label: "Planes" });
  return (
    <div className="container">
      <div className="panel-layout">
        <aside>
          <p className="small muted" style={{ margin: "0 0 8px" }}>Personal MAJ · {u.fullName || u.email}</p>
          <PanelNav items={items} label="Panel MAJ" />
        </aside>
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
