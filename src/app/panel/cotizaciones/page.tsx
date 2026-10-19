import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.quotes.meta };
}

export default async function Page() {
  const u = await requireUser("/panel/cotizaciones");
  const { d } = await getI18n();
  const t = d.panel.quotes;
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
      <h1>{t.title}</h1>
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && !quotes?.length ? (
        <div className="card empty">
          <p>{t.empty}</p>
          <Link className="btn btn-primary" href="/cotizaciones">{t.request}</Link>
        </div>
      ) : null}
      {quotes?.length ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.number}</th>
                <th scope="col">{t.service}</th>
                <th scope="col">{t.total}</th>
                <th scope="col">{t.validity}</th>
                <th scope="col">{t.status}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const tot = totalMap.get(q.id);
                return (
                  <tr key={q.id}>
                    <td><Link href={`/panel/cotizaciones/${q.id}`}>{q.number}</Link><div className="xs muted">{q.title}</div></td>
                    <td>{label(d.status.quoteServices, q.service)}</td>
                    <td>{tot ? formatMoney(tot.total, q.currency as Currency, { decimals: true }) : "—"}</td>
                    <td>{q.valid_until ? formatDate(q.valid_until) : "—"}</td>
                    <td><span className={statusBadge(q.status)}>{label(d.status.clientQuote, q.status)}</span></td>
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
