import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { hasRole, isStaffRole, requireUser } from "@/lib/auth";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { getSiteSettings } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/listing-editor/StatusBadge";
import { ApplicationForm } from "./ApplicationForm";

export const metadata: Metadata = { title: "Quiero publicar", robots: { index: false, follow: false } };

type App = {
  id: string; applicant_type: string; status: string; review_reason: string | null; created_at: string; reviewed_at: string | null; terms_version: string;
  plan: { name: string } | null; organization: { name: string; status: string } | null;
};
const TYPE_LABEL: Record<string, string> = { propietario: "Propietario", vendedor: "Vendedor / agente", agencia: "Agencia" };

export default async function PublishOnboardingPage() {
  const user = await requireUser("/panel/publicar");
  const supabase = await createClient();
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
    id: p.id, name: p.name, holder_type: p.holder_type, priceLabel: p.price === null ? "Precio por definir por MAJ" : formatMoney(p.price, p.currency),
  }));
  const open = apps.find((a) => a.status === "pendiente" || a.status === "documentos_requeridos");
  const approved = apps.some((a) => a.status === "aprobada");
  const isSeller = hasRole(user, "vendedor", "propietario", "agencia") || isStaffRole(user);
  const hasLicense = Boolean(lic?.length);
  const hasDocs = (docs ?? []).some((o) => o.name && !o.name.startsWith("."));
  const profileDone = Boolean(profile?.full_name && profile?.terms_version_accepted === termsVersion);

  const steps: { label: string; detail: string; done: boolean }[] = [
    { label: "Registro", detail: "Cuenta creada en MAJ.", done: true },
    { label: "Verificación de correo", detail: user.emailConfirmed ? "Correo verificado." : "Abra el enlace que le enviamos por correo.", done: user.emailConfirmed },
    { label: "Perfil y aceptación de condiciones", detail: "Nombre, teléfono y aceptación de las condiciones de publicación vigentes.", done: profileDone || Boolean(open) || approved },
    { label: "Documentación", detail: "Documento de identidad (opcional al inicio; MAJ puede solicitarlo).", done: hasDocs },
    { label: "Revisión de MAJ", detail: open ? "Su solicitud está en revisión." : approved ? "Solicitud aprobada." : "MAJ revisa cada solicitud.", done: approved },
    { label: "Activación", detail: hasLicense ? "Licencia activa: ya puede publicar." : "MAJ activa su licencia tras verificar el pago (si aplica).", done: hasLicense },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="section-sm">
      <h1>Quiero publicar en MAJ</h1>
      <p className="lead">
        Para publicar inmuebles necesita una <strong>licencia de publicación de MAJ</strong>: un permiso contractual interno para usar esta plataforma, con un número de
        publicaciones activas y una vigencia. <strong>No es una licencia profesional ni un permiso del gobierno</strong>, y MAJ no lo emite en nombre de ninguna autoridad.
      </p>

      {isSeller ? (
        <div className="alert alert-success" style={{ margin: "14px 0" }}>
          Su cuenta ya está habilitada para publicar. <Link href="/panel/publicaciones">Ir a mis publicaciones</Link> · <Link href="/panel/licencia">Ver mi licencia</Link>
        </div>
      ) : null}

      <section aria-labelledby="steps-title" className="card card-body" style={{ marginTop: 16 }}>
        <h2 id="steps-title" style={{ fontSize: "1.25rem" }}>Pasos</h2>
        <ol className="le-step-list">
          {steps.map((s, i) => (
            <li key={s.label} aria-current={i === current ? "step" : undefined}>
              <span className={`le-step-dot${s.done ? " done" : i === current ? " current" : ""}`} aria-hidden="true">{s.done ? "✓" : i + 1}</span>
              <span>
                <strong>{s.label}</strong>
                <span className="sr-only">{s.done ? " (completado)" : i === current ? " (paso actual)" : " (pendiente)"}</span>
                <span className="small muted" style={{ display: "block" }}>{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {apps.length ? (
        <section aria-labelledby="apps-title" style={{ marginTop: 22 }}>
          <h2 id="apps-title" style={{ fontSize: "1.25rem" }}>Mis solicitudes</h2>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Solicitudes para publicar</caption>
              <thead>
                <tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Plan</th><th scope="col">Estado</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td className="small">{formatDate(a.created_at, true)}</td>
                    <td className="small">
                      {TYPE_LABEL[a.applicant_type] ?? a.applicant_type}
                      {a.organization ? <span className="xs muted" style={{ display: "block" }}>{a.organization.name} (agencia {a.organization.status})</span> : null}
                    </td>
                    <td className="small">{a.plan?.name ?? "Por definir"}</td>
                    <td>
                      <StateBadge value={a.status} />
                      {a.review_reason ? <span className="small" style={{ display: "block", marginTop: 4 }}><strong>MAJ:</strong> {a.review_reason}</span> : null}
                      {a.reviewed_at ? <span className="xs muted" style={{ display: "block" }}>Revisada el {formatDate(a.reviewed_at)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open?.status === "documentos_requeridos" ? (
            <p className="alert alert-warning small" style={{ marginTop: 10 }}>
              MAJ necesita documentos adicionales. Revise el comentario y envíelos respondiendo al mensaje de MAJ o por WhatsApp indicando su correo.
            </p>
          ) : null}
        </section>
      ) : null}

      {!open ? (
        <section aria-labelledby="form-title" style={{ marginTop: 22 }}>
          <h2 id="form-title" style={{ fontSize: "1.25rem" }}>
            {isSeller ? "¿Quiere registrar una agencia o cambiar de plan?" : apps.length ? "Enviar una nueva solicitud" : "Solicitud"}
          </h2>
          {!user.emailConfirmed ? (
            <p className="alert alert-warning">Antes de enviar la solicitud, verifique su correo electrónico con el enlace que le enviamos al registrarse.</p>
          ) : isSeller ? (
            <details className="card card-body">
              <summary style={{ cursor: "pointer", fontWeight: 650 }}>Abrir formulario de solicitud</summary>
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
        Una cuenta aprobada no implica que MAJ haya verificado jurídicamente sus inmuebles. Cada publicación se revisa antes de mostrarse y los datos legales que declare se muestran como “declarados por el anunciante”.
      </p>
    </div>
  );
}
