import type { Metadata } from "next";
import Link from "next/link";
import { isStaffRole, requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { EnrollPanel, RemoveFactorForm, VerifyForm } from "./MfaForms";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.account.security.meta, robots: { index: false, follow: false } };
}

export default async function Page(props: PageProps<"/cuenta/seguridad">) {
  const sp = await props.searchParams;
  const { d } = await getI18n();
  const t = d.account.security;
  const rawNext = Array.isArray(sp.siguiente) ? sp.siguiente[0] : sp.siguiente;
  const next = rawNext ? safeNext(rawNext, "/panel") : "";
  const motivo = String(sp.motivo ?? "");
  const aviso = String(sp.aviso ?? "");

  if (!hasSupabase) {
    return (
      <div className="container section" style={{ maxWidth: 640 }}>
        <h1>{t.short}</h1>
        <p className="alert alert-warning">{t.demo}</p>
      </div>
    );
  }
  const u = await requireUser(`/cuenta/seguridad${rawNext ? `?siguiente=${encodeURIComponent(next)}` : ""}`);
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.all ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
  const needsVerification = verified.length > 0 && u.aal !== "aal2";

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <nav aria-label={d.common.breadcrumb} className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/panel">{t.myAccount}</Link> / <span aria-current="page">{t.short}</span>
      </nav>
      <h1>{t.title}</h1>

      {motivo === "mfa" ? (
        <p className="alert alert-warning" role="alert">
          {t.mfaRequired}
          {verified.length ? t.mfaEnterCode : t.mfaSetupFirst}
        </p>
      ) : null}
      {aviso === "verificado" ? <p className="alert alert-success" role="status">{t.verified}</p> : null}

      <section className="card card-body" style={{ marginTop: 16 }} aria-labelledby="mfa-title">
        <h2 id="mfa-title" style={{ marginTop: 0 }}>{t.twoStep}</h2>
        <p className="small muted">
          {t.sessionState}{" "}
          {u.aal === "aal2" ? <span className="badge badge-success">{t.sessionAal2}</span> : <span className="badge">{t.sessionAal1}</span>}
        </p>

        {needsVerification ? (
          <>
            <p>{t.needsCode}</p>
            <VerifyForm factorId={verified[0].id} next={next || "/panel"} />
          </>
        ) : verified.length ? (
          <div className="stack">
            <p>{t.active}</p>
            <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
              {verified.map((f) => (
                <li key={f.id} className="box">
                  <p style={{ margin: "0 0 8px" }}>
                    <strong>{f.friendly_name || t.authenticatorApp}</strong>
                    <br />
                    <span className="xs muted">{fmt(t.activatedOn, { date: formatDate(f.created_at, true) })}</span>
                  </p>
                  {isStaffRole(u) ? (
                    <p className="xs muted">{t.staffNeedsMfa}</p>
                  ) : null}
                  <RemoveFactorForm factorId={f.id} />
                </li>
              ))}
            </ul>
            {next ? <Link className="btn btn-primary" href={next}>{t.continue}</Link> : null}
          </div>
        ) : (
          <>
            <p>
              {t.addFactor}
              {isStaffRole(u) ? t.staffMandatory : ""}
            </p>
            <EnrollPanel next={next} />
          </>
        )}
      </section>

      <section className="card card-body" style={{ marginTop: 16 }} aria-labelledby="pw-title">
        <h2 id="pw-title" style={{ marginTop: 0 }}>{t.password}</h2>
        <p className="small">{fmt(t.accountEmail, { email: u.email })}</p>
        <Link className="btn btn-outline btn-sm" href="/cuenta/nueva-clave">{t.changePassword}</Link>
      </section>
    </div>
  );
}
