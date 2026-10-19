import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { ProfileForm } from "./ProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.profile.meta };
}

export default async function Page() {
  const u = await requireUser("/panel/perfil");
  const t = (await getI18n()).d.panel.profile;
  const supabase = await createClient();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("full_name, display_name, terms_version_accepted, terms_accepted_at").eq("id", u.id).maybeSingle(),
    supabase.from("profile_private").select("phone, whatsapp, marketing_opt_in").eq("user_id", u.id).maybeSingle(),
  ]);
  return (
    <div className="stack" style={{ paddingBottom: 32 }}>
      <h1>{t.title}</h1>
      <section className="card card-body">
        <p className="small" style={{ marginTop: 0 }}>{t.email} <strong>{u.email}</strong></p>
        <ProfileForm
          fullName={profile?.full_name ?? ""}
          displayName={profile?.display_name ?? ""}
          phone={priv?.phone ?? ""}
          whatsapp={priv?.whatsapp ?? ""}
          marketing={Boolean(priv?.marketing_opt_in)}
        />
      </section>
      <section className="card card-body">
        <h2 style={{ marginTop: 0 }}>{t.terms}</h2>
        <p className="small">
          {profile?.terms_version_accepted
            ? `${fmt(t.termsVersion, { v: profile.terms_version_accepted })}${profile.terms_accepted_at ? fmt(t.termsAcceptedOn, { date: formatDate(profile.terms_accepted_at, true) }) : ""}.`
            : t.noTerms}{" "}
          <Link href="/legal/terminos">{t.termsLink}</Link> · <Link href="/legal/privacidad">{t.privacyLink}</Link>
        </p>
        <p className="small">{t.securityBefore} <Link href="/cuenta/seguridad">{t.securityLink}</Link>.</p>
      </section>
    </div>
  );
}
