import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/listing-editor/StatusBadge";
import { ApplicationForm } from "./ApplicationForm";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.publish.meta, robots: { index: false, follow: false } };
}

type App = {
  id: string; applicant_type: string; status: string; review_reason: string | null; created_at: string; reviewed_at: string | null; terms_version: string;
  plan: { name: string } | null; organization: { name: string; status: string } | null;
};

export default async function PublishOnboardingPage() {
  const user = await requireUser("/panel/publicar");
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.panel.publish;
  const TYPE_LABEL: Record<string, string> = t.types;
  const [settings, { data: appData }, { data: planData }, { data: profile }, { data: lic }, { data: docs }] = await Promise.all([
    getSiteSettings(),
    supabase
      .from("publisher_applications")
      .select("id, applicant_type, status, review_reason, created_at, reviewed_at, terms_version, plan:plans(name), organization:organizations(name, status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("id, name, holder_type, price, currency").eq("is_active", true).order("sort_order"),
    supabase.from("profiles").select("full_name, terms_version_accepted").eq("id", user.id).maybeSingle(),
    supabase.from("licenses").select("id").eq("status", "activa").gt("ends_at", new Date().toISOString()).limit(1),
    supabase.storage.from("private-docs").list(`profiles/${user.id}`, { limit: 5 }),
  ]);
  const apps = (appData ?? []) as unknown as App[];
  const termsVersion = String(settings["legal.documents_version"] ?? "");
  const plans = ((planData ?? []) as { id: string; name: string; holder_type: "individual" | "organizacion"; price: number | string | null; currency: Currency }[]).map((p) => ({
    id: p.id, name: p.name, holder_type: p.holder_type, priceLabel: p.price === null ? t.priceTbd : formatMoney(p.price, p.currency),
  }));
  const open = apps.find((a) => a.status === "pendiente" || a.status === "documentos_requeridos");
  const approved = apps.some((a) => a.status === "aprobada");
  const isSeller = hasRole(user, "vendedor", "propietario", "agencia") || isStaffRole(user);
  const hasLicense = Boolean(lic?.length);
  const hasDocs = (docs ?? []).some((o) => o.name && !o.name.startsWith("."));
  const profileDone = Boolean(profile?.full_name && profile?.terms_version_accepted === termsVersion);

  const steps: { label: string; detail: string; done: boolean }[] = [
    { label: t.s1, detail: t.s1d, done: true },
    { label: t.s2, detail: user.emailConfirmed ? t.s2ok : t.s2todo, done: user.emailConfirmed },
    { label: t.s3, detail: t.s3d, done: profileDone || Boolean(open) || approved },
    { label: t.s4, detail: t.s4d, done: hasDocs },
    { label: t.s5, detail: open ? t.s5open : approved ? t.s5ok : t.s5todo, done: approved },
    { label: t.s6, detail: hasLicense ? t.s6ok : t.s6todo, done: hasLicense },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="section-sm">
      <h1>{t.title}</h1>
      <p className="lead">
        {t.leadBefore} <strong>{t.leadStrong}</strong>{t.leadMiddle} <strong>{t.leadStrong2}</strong>{t.leadAfter}
      </p>

      {isSeller ? (
        <div className="alert alert-success" style={{ margin: "14px 0" }}>
          {t.enabled} <Link href="/panel/publicaciones">{t.goListings}</Link> · <Link href="/panel/licencia">{t.viewLicense}</Link>
        </div>
      ) : null}

      <section aria-labelledby="steps-title" className="card card-body" style={{ marginTop: 16 }}>
        <h2 id="steps-title" style={{ fontSize: "1.25rem" }}>{t.steps}</h2>
        <ol className="le-step-list">
          {steps.map((s, i) => (
            <li key={s.label} aria-current={i === current ? "step" : undefined}>
              <span className={`le-step-dot${s.done ? " done" : i === current ? " current" : ""}`} aria-hidden="true">{s.done ? "✓" : i + 1}</span>
              <span>
                <strong>{s.label}</strong>
                <span className="sr-only">{s.done ? t.done : i === current ? t.current : t.pendingStep}</span>
                <span className="small muted" style={{ display: "block" }}>{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {apps.length ? (
        <section aria-labelledby="apps-title" style={{ marginTop: 22 }}>
          <h2 id="apps-title" style={{ fontSize: "1.25rem" }}>{t.apps}</h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.appsCaption}</caption>
              <thead>
                <tr><th scope="col">{t.date}</th><th scope="col">{t.type}</th><th scope="col">{t.plan}</th><th scope="col">{t.status}</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{formatDate(a.created_at, true)}</td>
                    <td className="small">
                      {TYPE_LABEL[a.applicant_type] ?? a.applicant_type}
                      {a.organization ? <span className="xs muted" style={{ display: "block" }}>{fmt(t.agencyStatus, { name: a.organization.name, status: (d.status.org[a.organization.status] ?? a.organization.status).toLowerCase() })}</span> : null}
                    </td>
                    <td className="small">{a.plan?.name ?? t.tbd}</td>
                    <td>
                      <StateBadge value={a.status} />
                      {a.review_reason ? <span className="small" style={{ display: "block", marginTop: 4 }}><strong>MAJ:</strong> {a.review_reason}</span> : null}
                      {a.reviewed_at ? <span className="xs muted" style={{ display: "block" }}>{fmt(t.reviewedOn, { date: formatDate(a.reviewed_at) })}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open?.status === "documentos_requeridos" ? (
            <p className="alert alert-warning small" style={{ marginTop: 10 }}>
              {t.docsRequired}
            </p>
          ) : null}
        </section>
      ) : null}

      {!open ? (
        <section aria-labelledby="form-title" style={{ marginTop: 22 }}>
          <h2 id="form-title" style={{ fontSize: "1.25rem" }}>
            {isSeller ? t.formSeller : apps.length ? t.formAgain : t.form}
          </h2>
          {!user.emailConfirmed ? (
            <p className="alert alert-warning">{t.verifyFirst}</p>
          ) : isSeller ? (
            <details className="card card-body">
              <summary style={{ cursor: "pointer", fontWeight: 650 }}>{t.openForm}</summary>
              <div style={{ marginTop: 12 }}>
                <ApplicationForm userId={user.id} plans={plans} termsVersion={termsVersion} defaultName={profile?.full_name ?? user.fullName} />
              </div>
            </details>
          ) : (
            <ApplicationForm userId={user.id} plans={plans} termsVersion={termsVersion} defaultName={profile?.full_name ?? user.fullName} />
          )}
        </section>
      ) : null}

      <p className="xs muted" style={{ marginTop: 18 }}>
        {t.disclaimer}
      </p>
    </div>
  );
}
