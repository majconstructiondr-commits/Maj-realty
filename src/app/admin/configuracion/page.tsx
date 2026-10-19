import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { settingKind } from "@/lib/admin/settings";
import { adminCtx, labelFor, userLabels } from "@/lib/admin/server";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { saveSetting } from "./actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

type Setting = { key: string; value: unknown; is_public: boolean; description: string | null; updated_at: string; updated_by: string | null };
type Check = { ok: boolean; label: string; detail?: string };

export default async function AdminSettings() {
  const { supabase } = await adminCtx("/admin/configuracion");
  const t = (await getI18n()).d.admin.settings;
  const [settings, demoProps, demoReqs, demoQuotes, plansNoPrice, rates, legalOn] = await Promise.all([
    supabase.from("site_settings").select("*").order("key"),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("service_requests").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("plans").select("id", { count: "exact", head: true }).eq("is_active", true).is("price", null),
    supabase.from("exchange_rates").select("id", { count: "exact", head: true }),
    supabase.from("legal_services").select("code", { count: "exact", head: true }).eq("enabled", true),
  ]);
  const rows = (settings.data ?? []) as Setting[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const people = await userLabels(supabase, rows.map((r) => r.updated_by));
  const pending = ["company.email", "company.address", "company.rnc", "company.hours"].filter((k) => get(k) === null || get(k) === "");
  const legalVersion = String(get("legal.documents_version") ?? "");
  const demoTotal = (demoProps.count ?? 0) + (demoReqs.count ?? 0) + (demoQuotes.count ?? 0);
  const tax = get("quotes.default_tax") as { label?: string | null; rate?: number } | undefined;

  const checks: Check[] = [
    { ok: get("company.data_confirmed") === true, label: t.chkCompany, detail: pending.length ? fmt(t.chkCompanyPending, { keys: pending.join(", ") }) : undefined },
    { ok: demoTotal === 0, label: t.chkNoDemo, detail: fmt(t.chkNoDemoDetail, { p: demoProps.count ?? 0, r: demoReqs.count ?? 0, q: demoQuotes.count ?? 0 }) },
    { ok: get("site.show_demo_data") === false, label: t.chkDemoHidden },
    { ok: Boolean(env.logoSrc), label: t.chkLogo, detail: env.logoSrc },
    { ok: !/borrador/i.test(legalVersion), label: t.chkLegal, detail: fmt(t.chkLegalDetail, { v: legalVersion || t.noVersion }) },
    { ok: get("security.require_mfa_for_staff") === true, label: t.chkMfa },
    { ok: (plansNoPrice.count ?? 0) === 0, label: t.chkPlans, detail: fmt(t.chkPlansDetail, { n: plansNoPrice.count ?? 0 }) },
    { ok: Boolean(tax?.label), label: t.chkTax },
    { ok: (rates.count ?? 0) > 0, label: t.chkRate, detail: t.chkRateDetail },
    { ok: Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY), label: t.chkCron },
    { ok: Boolean(process.env.TURNSTILE_SECRET_KEY && env.turnstileSiteKey), label: t.chkTurnstile },
    { ok: true, label: fmt(t.chkLegalServices, { n: legalOn.count ?? 0 }), detail: t.chkLegalServicesDetail },
  ];

  return (
    <>
      <PageHeader title={t.title} />
      <section className="card card-body stack" aria-labelledby="checklist">
        <h2 id="checklist">{t.checklist}</h2>
        <ul className="timeline">
          {checks.map((c) => (
            <li key={c.label} style={{ borderLeftColor: c.ok ? "var(--success)" : "var(--warning)" }}>
              <span className={`badge ${c.ok ? "badge-success" : "badge-warning"}`}>{c.ok ? t.ready : t.pending}</span> {c.label}
              {c.detail && <div className="xs muted">{c.detail}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" style={{ marginTop: 16 }}>
        <h2>{t.values}</h2>
        <p className="small muted">{t.valuesNote}</p>
        {settings.error && <p className="alert alert-error">{t.loadError}</p>}
        {rows.map((s) => {
          const kind = settingKind(s.value);
          const id = `s-${s.key.replace(/[^a-z0-9]/gi, "-")}`;
          return (
            <article key={s.key} className="card card-body stack">
              <div className="row-between">
                <strong><code>{s.key}</code></strong>
                <span className="xs muted">{s.is_public ? t.public : t.internal} · {formatDate(s.updated_at, true)}{s.updated_by ? ` · ${labelFor(people, s.updated_by)}` : ""}</span>
              </div>
              {s.description && <p className="small" style={{ margin: 0 }}>{s.description}</p>}
              <ActionForm action={saveSetting} submit={t.save} buttonClass="btn btn-ghost btn-sm">
                <input type="hidden" name="key" value={s.key} />
                <input type="hidden" name="kind" value={kind} />
                {kind === "boolean" ? (
                  <label className="check" htmlFor={id}><input id={id} type="checkbox" name="bool" defaultChecked={s.value === true} /> {t.enabled}</label>
                ) : kind === "number" ? (
                  <input id={id} name="value" type="number" step="any" className="input" aria-label={s.key} defaultValue={String(s.value)} style={{ maxWidth: 200 }} />
                ) : kind === "text" ? (
                  <input id={id} name="value" className="input" aria-label={s.key} maxLength={2000} defaultValue={(s.value as string | null) ?? ""} placeholder={t.noData} />
                ) : (
                  <textarea id={id} name="value" className="textarea" aria-label={s.key} rows={4} defaultValue={JSON.stringify(s.value, null, 2)} style={{ fontFamily: "monospace" }} />
                )}
              </ActionForm>
            </article>
          );
        })}
      </section>
    </>
  );
}
