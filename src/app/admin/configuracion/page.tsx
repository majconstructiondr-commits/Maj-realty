import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { settingKind } from "@/lib/admin/settings";
import { adminCtx, labelFor, userLabels } from "@/lib/admin/server";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { saveSetting } from "./actions";

type Setting = { key: string; value: unknown; is_public: boolean; description: string | null; updated_at: string; updated_by: string | null };
type Check = { ok: boolean; label: string; detail?: string };

export default async function AdminSettings() {
  const { supabase } = await adminCtx("/admin/configuracion");
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
    { ok: get("company.data_confirmed") === true, label: "Datos de la empresa confirmados (company.data_confirmed)", detail: pending.length ? `Por confirmar: ${pending.join(", ")}` : undefined },
    { ok: demoTotal === 0, label: "Sin datos de demostración en la base", detail: `Inmuebles: ${demoProps.count ?? 0} · solicitudes: ${demoReqs.count ?? 0} · cotizaciones: ${demoQuotes.count ?? 0}` },
    { ok: get("site.show_demo_data") === false, label: "Datos de demostración ocultos en el catálogo (site.show_demo_data = false)" },
    { ok: Boolean(env.logoSrc), label: "Logo oficial configurado (NEXT_PUBLIC_LOGO_SRC)", detail: env.logoSrc ? env.logoSrc : "Se muestra un logo provisional" },
    { ok: !/borrador/i.test(legalVersion), label: "Documentos legales revisados por abogado", detail: `Versión actual: ${legalVersion || "sin versión"}` },
    { ok: get("security.require_mfa_for_staff") === true, label: "Segundo factor obligatorio para el personal" },
    { ok: (plansNoPrice.count ?? 0) === 0, label: "Precios de planes definidos", detail: `${plansNoPrice.count ?? 0} plan(es) activos con precio por definir` },
    { ok: Boolean(tax?.label), label: "Impuesto por defecto de cotizaciones configurado con el contador (quotes.default_tax)" },
    { ok: (rates.count ?? 0) > 0, label: "Tasa de cambio registrada con fuente", detail: "Sin tasa, el sitio no muestra conversiones (correcto si no se desea)" },
    { ok: Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY), label: "Tareas programadas configuradas (CRON_SECRET y SUPABASE_SERVICE_ROLE_KEY en el servidor)" },
    { ok: Boolean(process.env.TURNSTILE_SECRET_KEY && env.turnstileSiteKey), label: "Protección anti-bots (Turnstile) configurada" },
    { ok: true, label: `Servicios legales habilitados: ${legalOn.count ?? 0}`, detail: "Habilítelos solo con profesional responsable" },
  ];

  return (
    <>
      <PageHeader title="Configuración" />
      <section className="card card-body stack" aria-labelledby="checklist">
        <h2 id="checklist">Lista de verificación antes del lanzamiento</h2>
        <ul className="timeline">
          {checks.map((c) => (
            <li key={c.label} style={{ borderLeftColor: c.ok ? "var(--success)" : "var(--warning)" }}>
              <span className={`badge ${c.ok ? "badge-success" : "badge-warning"}`}>{c.ok ? "Listo" : "Pendiente"}</span> {c.label}
              {c.detail && <div className="xs muted">{c.detail}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" style={{ marginTop: 16 }}>
        <h2>Valores del sitio</h2>
        <p className="small muted">Los valores “públicos” se muestran a los visitantes. Texto vacío guarda “sin dato” (por confirmar) y el sitio no lo muestra como activo.</p>
        {settings.error && <p className="alert alert-error">No se pudo cargar la configuración.</p>}
        {rows.map((s) => {
          const kind = settingKind(s.value);
          const id = `s-${s.key.replace(/[^a-z0-9]/gi, "-")}`;
          return (
            <article key={s.key} className="card card-body stack">
              <div className="row-between">
                <strong><code>{s.key}</code></strong>
                <span className="xs muted">{s.is_public ? "Público" : "Interno"} · {formatDate(s.updated_at, true)}{s.updated_by ? ` · ${labelFor(people, s.updated_by)}` : ""}</span>
              </div>
              {s.description && <p className="small" style={{ margin: 0 }}>{s.description}</p>}
              <ActionForm action={saveSetting} submit="Guardar" buttonClass="btn btn-ghost btn-sm">
                <input type="hidden" name="key" value={s.key} />
                <input type="hidden" name="kind" value={kind} />
                {kind === "boolean" ? (
                  <label className="check" htmlFor={id}><input id={id} type="checkbox" name="bool" defaultChecked={s.value === true} /> Activado</label>
                ) : kind === "number" ? (
                  <input id={id} name="value" type="number" step="any" className="input" aria-label={s.key} defaultValue={String(s.value)} style={{ maxWidth: 200 }} />
                ) : kind === "text" ? (
                  <input id={id} name="value" className="input" aria-label={s.key} maxLength={2000} defaultValue={(s.value as string | null) ?? ""} placeholder="Sin dato (por confirmar)" />
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
