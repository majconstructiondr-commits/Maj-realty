import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false, follow: false } };

export default async function Page() {
  if (hasSupabase) await requireUser("/cuenta/nueva-clave");
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>Nueva contraseña</h1>
      <div className="card card-body" style={{ marginTop: 16 }}>
        <NewPasswordForm />
      </div>
    </div>
  );
}
