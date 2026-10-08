import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { REQUEST_KINDS, REQUEST_STATUSES } from "@/lib/catalog/definitions";
import { formatDate } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis solicitudes" };

export default async function Page() {
  const u = await requireUser("/panel/solicitudes");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("id, number, kind, status, property_ref, created_at, updated_at")
    .eq("client_user_id", u.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Mis solicitudes</h1>
      <p className="small muted">Solicitudes enviadas con su cuenta. Las enviadas sin iniciar sesión no aparecen aquí.</p>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus solicitudes. Intente de nuevo.</p> : null}
      {!error && !data?.length ? (
        <div className="card empty">
          <p>Aún no tiene solicitudes.</p>
          <Link className="btn btn-primary" href="/contacto">Enviar una solicitud</Link>
        </div>
      ) : null}
      {data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Solicitudes</caption>
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/panel/solicitudes/${r.id}`}>{r.number}</Link></td>
                  <td>{label(REQUEST_KINDS, r.kind)}{r.property_ref ? <div className="xs muted">Ref. {r.property_ref}</div> : null}</td>
                  <td><span className={statusBadge(r.status)}>{label(REQUEST_STATUSES, r.status)}</span></td>
                  <td>{formatDate(r.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
