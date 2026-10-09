import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Perfil" };

export default async function Page() {
  const u = await requireUser("/panel/perfil");
  const supabase = await createClient();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, terms_version_accepted, terms_accepted_at").eq("id", u.id).maybeSingle(),
    supabase.from("profile_private").select("phone, whatsapp, marketing_opt_in").eq("user_id", u.id).maybeSingle(),
  ]);
  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>Perfil</h1>
      <section className="card card-body">
        <p className="small" style={{ marginTop: 0 }}>Correo: <strong>{u.email}</strong></p>
        <ProfileForm
          fullName={profile?.full_name ?? ""}
          displayName={profile?.display_name ?? ""}
          phone={priv?.phone ?? ""}
          whatsapp={priv?.whatsapp ?? ""}
          marketing={Boolean(priv?.marketing_opt_in)}
        />
      </section>
      <section className="card card-body">
        <h2 style={{ marginTop: 0 }}>Términos aceptados</h2>
        <p className="small">
          {profile?.terms_version_accepted
            ? `Versión ${profile.terms_version_accepted}${profile.terms_accepted_at ? `, aceptada el ${formatDate(profile.terms_accepted_at, true)}` : ""}.`
            : "Sin registro de aceptación."}{" "}
          <Link href="/legal/terminos">Términos</Link> · <Link href="/legal/privacidad">Privacidad</Link>
        </p>
        <p className="small">Contraseña y verificación en dos pasos: <Link href="/cuenta/seguridad">Seguridad</Link>.</p>
      </section>
    </div>
  );
}
