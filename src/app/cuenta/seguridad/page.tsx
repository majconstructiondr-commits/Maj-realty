import type { Metadata } from "next";
import Link from "next/link";
import { isStaffRole, requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { EnrollPanel, RemoveFactorForm, VerifyForm } from "./MfaForms";

export const metadata: Metadata = { title: "Seguridad de la cuenta", robots: { index: false, follow: false } };

export default async function Page(props: PageProps<"/cuenta/seguridad">) {
  const sp = await props.searchParams;
  const rawNext = Array.isArray(sp.siguiente) ? sp.siguiente[0] : sp.siguiente;
  const next = rawNext ? safeNext(rawNext, "/panel") : "";
  const motivo = String(sp.motivo ?? "");
  const aviso = String(sp.aviso ?? "");

  if (!hasSupabase) {
    return (
      <div className="container section" style={{ maxWidth: 640 }}>
        <h1>Seguridad</h1>
        <p className="alert alert-warning">Modo demostración: disponible cuando se configure la base de datos.</p>
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
      <nav aria-label="Ruta" className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/panel">Mi cuenta</Link> / <span aria-current="page">Seguridad</span>
      </nav>
      <h1>Seguridad de la cuenta</h1>

      {motivo === "mfa" ? (
        <p className="alert alert-warning" role="alert">
          Para entrar al panel del personal de MAJ debe verificar un segundo factor de autenticación (código de una aplicación).
          {verified.length ? " Escriba el código actual de su aplicación." : " Primero configure su aplicación de autenticación."}
        </p>
      ) : null}
      {aviso === "verificado" ? <p className="alert alert-success" role="status">Segundo factor verificado correctamente.</p> : null}

      <section className="card card-body" style={{ marginTop: 16 }} aria-labelledby="mfa-title">
        <h2 id="mfa-title" style={{ marginTop: 0 }}>Verificación en dos pasos</h2>
        <p className="small muted">
          Estado de la sesión:{" "}
          {u.aal === "aal2" ? <span className="badge badge-success">Verificada con segundo factor</span> : <span className="badge">Solo contraseña</span>}
        </p>

        {needsVerification ? (
          <>
            <p>Su cuenta tiene un segundo factor activo. Introduzca el código para continuar.</p>
            <VerifyForm factorId={verified[0].id} next={next || "/panel"} />
          </>
        ) : verified.length ? (
          <div className="stack">
            <p>La verificación en dos pasos está activa.</p>
            <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
              {verified.map((f) => (
                <li key={f.id} className="box">
                  <p style={{ margin: "0 0 8px" }}>
                    <strong>{f.friendly_name || "Aplicación de autenticación"}</strong>
                    <br />
                    <span className="xs muted">Activado el {formatDate(f.created_at, true)}</span>
                  </p>
                  {isStaffRole(u) ? (
                    <p className="xs muted">El personal de MAJ necesita un segundo factor para usar el panel interno.</p>
                  ) : null}
                  <RemoveFactorForm factorId={f.id} />
                </li>
              ))}
            </ul>
            {next ? <Link className="btn btn-primary" href={next}>Continuar</Link> : null}
          </div>
        ) : (
          <>
            <p>
              Añada un código temporal desde una aplicación de autenticación para proteger su cuenta aunque alguien conozca su contraseña.
              {isStaffRole(u) ? " Es obligatorio para el personal de MAJ." : ""}
            </p>
            <EnrollPanel next={next} />
          </>
        )}
      </section>

      <section className="card card-body" style={{ marginTop: 16 }} aria-labelledby="pw-title">
        <h2 id="pw-title" style={{ marginTop: 0 }}>Contraseña</h2>
        <p className="small">Cuenta: {u.email}</p>
        <Link className="btn btn-outline btn-sm" href="/cuenta/nueva-clave">Cambiar contraseña</Link>
      </section>
    </div>
  );
}
