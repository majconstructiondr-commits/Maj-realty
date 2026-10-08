import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>Recuperar contraseña</h1>
      <p className="muted">Le enviaremos un enlace para crear una nueva contraseña. El enlace vence en poco tiempo.</p>
      <div className="card card-body" style={{ marginTop: 16 }}>
        <ResetForm />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        <Link href="/cuenta/ingresar">Volver a ingresar</Link>
      </p>
    </div>
  );
}
