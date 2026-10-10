import type { Metadata } from "next";
import { PanelNav } from "@/components/panel/PanelNav";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { getSellerContext } from "@/lib/listing-editor/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase) {
    return (
      <div className="container section">
        <h1>Mi cuenta</h1>
        <p className="alert alert-warning">Modo demostración: las cuentas estarán disponibles cuando se configure la base de datos (ver README).</p>
      </div>
    );
  }
  const u = await requireUser("/panel");
  const items = [
    { href: "/panel", label: "Resumen" },
    { href: "/panel/solicitudes", label: "Solicitudes" },
    { href: "/panel/cotizaciones", label: "Cotizaciones" },
    { href: "/panel/mensajes", label: "Mensajes" },
    { href: "/panel/visitas", label: "Visitas" },
    { href: "/panel/favoritos", label: "Favoritos" },
    { href: "/panel/busquedas", label: "Búsquedas guardadas" },
  ];
  // Miembros de una agencia (añadidos por correo) no tienen el rol "agencia", pero sí membresía.
  const memberships = (await getSellerContext())?.memberships ?? [];
  if (hasRole(u, "vendedor", "agencia", "propietario") || isStaffRole(u) || memberships.length > 0) {
    items.push({ href: "/panel/publicaciones", label: "Mis publicaciones" }, { href: "/panel/licencia", label: "Licencia" });
  } else {
    items.push({ href: "/panel/publicar", label: "Quiero publicar" });
  }
  if (hasRole(u, "agencia") || memberships.length > 0) items.push({ href: "/panel/organizacion", label: "Mi agencia" });
  if (hasRole(u, "propietario")) items.push({ href: "/panel/administracion", label: "Mis propiedades administradas" });
  const { count: tenantLeases } = await (await createClient()).from("rental_leases").select("id", { count: "exact", head: true }).eq("tenant_user_id", u.id);
  if (tenantLeases) items.push({ href: "/panel/rentas", label: "Mis rentas" });
  items.push({ href: "/panel/perfil", label: "Perfil" }, { href: "/cuenta/seguridad", label: "Seguridad" });
  if (isStaffRole(u)) items.push({ href: "/admin", label: "Panel MAJ" });
  return (
    <div className="container">
      <div className="panel-layout">
        <aside>
          <p className="small muted" style={{ margin: "0 0 8px" }}>Hola, {u.fullName || u.email}</p>
          <PanelNav items={items} label="Mi cuenta" />
          <form action="/auth/salir" method="post" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" type="submit">Cerrar sesión</button>
          </form>
        </aside>
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
