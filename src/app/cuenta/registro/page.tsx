import type { Metadata } from "next";
import Link from "next/link";
import { hasSupabase } from "@/lib/env";
import { getSiteSettings } from "@/lib/site";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false, follow: false } };

export default async function Page() {
  const s = await getSiteSettings();
  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <h1>Crear cuenta</h1>
      <p className="muted">Con su cuenta puede seguir solicitudes, chatear con el equipo, agendar visitas y guardar favoritos.</p>
      {!hasSupabase ? <p className="alert alert-warning">Modo demostración: las cuentas estarán disponibles cuando se configure la base de datos.</p> : null}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <SignUpForm termsVersion={String(s["legal.documents_version"])} />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        ¿Ya tiene cuenta? <Link href="/cuenta/ingresar">Ingresar</Link>
      </p>
    </div>
  );
}
