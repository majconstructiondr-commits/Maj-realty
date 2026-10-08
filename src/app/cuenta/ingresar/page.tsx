import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: false } };

const NOTICES: Record<string, { kind: "error" | "success" | "info"; text: string }> = {
  enlace: { kind: "error", text: "El enlace no es válido o ya venció. Solicite uno nuevo o inicie sesión." },
  confirmado: { kind: "success", text: "Correo confirmado. Ya puede iniciar sesión." },
  salida: { kind: "info", text: "Sesión cerrada." },
};

export default async function Page(props: PageProps<"/cuenta/ingresar">) {
  const sp = await props.searchParams;
  const next = safeNext(Array.isArray(sp.siguiente) ? sp.siguiente[0] : sp.siguiente, "/panel");
  const notice = NOTICES[String(sp.aviso ?? sp.error ?? "")];
  if (await getSessionUser()) redirect(next);
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>Ingresar</h1>
      <p className="muted">Acceda a sus solicitudes, mensajes, visitas y cotizaciones.</p>
      {notice ? <p className={`alert alert-${notice.kind}`} role="status">{notice.text}</p> : null}
      {!hasSupabase ? <p className="alert alert-warning">Modo demostración: las cuentas estarán disponibles cuando se configure la base de datos.</p> : null}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <LoginForm next={next} />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        ¿No tiene cuenta? <Link href={`/cuenta/registro${next !== "/panel" ? `?siguiente=${encodeURIComponent(next)}` : ""}`}>Crear una cuenta</Link>
      </p>
    </div>
  );
}
