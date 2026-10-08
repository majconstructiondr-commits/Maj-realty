import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { CONTRACT_STATUSES, label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Propiedades administradas" };

export default async function Page() {
  const u = await requireUser("/panel/administracion");
  if (!hasRole(u, "propietario") && !isStaffRole(u)) redirect("/panel?aviso=sin-permiso");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("management_contracts")
    .select("id, property_label, location_summary, units, status, start_date, end_date")
    .eq("owner_user_id", u.id)
    .order("start_date", { ascending: false });

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Mis propiedades administradas</h1>
      <p className="alert alert-info small">
        Este portal es un registro operativo de la administración que realiza MAJ REALTY. No es un servicio bancario ni contabilidad certificada;
        los importes se muestran en su moneda original y nunca se suman monedas distintas.
      </p>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus contratos.</p> : null}
      {!error && !data?.length ? (
        <div className="card empty">
          <p>No tiene contratos de administración registrados.</p>
          <Link className="btn btn-primary" href="/administracion">Conocer el servicio</Link>
        </div>
      ) : null}
      <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
        {(data ?? []).map((c) => (
          <li key={c.id} className="card card-body">
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <Link href={`/panel/administracion/${c.id}`} style={{ fontWeight: 700 }}>{c.property_label}</Link>
                {c.location_summary ? <div className="small muted">{c.location_summary}</div> : null}
                <div className="xs muted">
                  {c.units} {c.units === 1 ? "unidad" : "unidades"} · Desde {formatDate(c.start_date)}{c.end_date ? ` hasta ${formatDate(c.end_date)}` : ""}
                </div>
              </div>
              <span className={statusBadge(c.status)}>{label(CONTRACT_STATUSES, c.status)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
