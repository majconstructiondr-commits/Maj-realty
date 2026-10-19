import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { label, statusBadge } from "@/lib/panel/labels";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.managed.meta };
}

export default async function Page() {
  const u = await requireUser("/panel/administracion");
  if (!hasRole(u, "propietario") && !isStaffRole(u)) redirect("/panel?aviso=sin-permiso");
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.managed;
  const { data, error } = await supabase
    .from("management_contracts")
    .select("id, property_label, location_summary, units, status, start_date, end_date")
    .eq("owner_user_id", u.id)
    .order("start_date", { ascending: false });

  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      <p className="alert alert-info small">
        {t.note}
      </p>
      {error ? <p className="alert alert-error" role="alert">{t.error}</p> : null}
      {!error && !data?.length ? (
        <div className="card empty">
          <p>{t.empty}</p>
          <Link className="btn btn-primary" href="/administracion">{t.learn}</Link>
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
                  {c.units} {c.units === 1 ? t.unit : t.units} · {fmt(t.since, { date: formatDate(c.start_date) })}{c.end_date ? fmt(t.until, { date: formatDate(c.end_date) }) : ""}
                </div>
              </div>
              <span className={statusBadge(c.status)}>{label(d.status.contract, c.status)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
