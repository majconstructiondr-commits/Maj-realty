import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { label, QUOTE_SERVICES, QUOTE_STATUSES, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis cotizaciones" };

export default async function Page() {
  const u = await requireUser("/panel/cotizaciones");
  const supabase = await createClient();
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, number, title, service, currency, status, valid_until, sent_at")
    .eq("client_user_id", u.id)
    .neq("status", "borrador")
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(100);
  const ids = (quotes ?? []).map((q) => q.id);
  const { data: totals } = ids.length ? await supabase.from("quote_totals").select("quote_id, total, currency").in("quote_id", ids) : { data: [] };
  const totalMap = new Map((totals ?? []).map((t) => [t.quote_id as string, t]));

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Mis cotizaciones</h1>
      {error ? <p className="alert alert-error" role="alert">No se pudieron cargar sus cotizaciones.</p> : null}
      {!error && !quotes?.length ? (
        <div className="card empty">
          <p>Aún no tiene cotizaciones.</p>
          <Link className="btn btn-primary" href="/cotizaciones">Solicitar una cotización</Link>
        </div>
      ) : null}
      {quotes?.length ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Cotizaciones</caption>
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Servicio</th>
                <th scope="col">Total</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const t = totalMap.get(q.id);
                return (
                  <tr key={q.id}>
                    <td><Link href={`/panel/cotizaciones/${q.id}`}>{q.number}</Link><div className="xs muted">{q.title}</div></td>
                    <td>{label(QUOTE_SERVICES, q.service)}</td>
                    <td>{t ? formatMoney(t.total, q.currency as Currency, { decimals: true }) : "—"}</td>
                    <td>{q.valid_until ? formatDate(q.valid_until) : "—"}</td>
                    <td><span className={statusBadge(q.status)}>{label(QUOTE_STATUSES, q.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
