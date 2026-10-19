import type { Metadata } from "next";
import Link from "next/link";
import { hasSupabase } from "@/lib/env";
import { getSiteSettings } from "@/lib/site";
import { getI18n } from "@/i18n/server";
import { SignUpForm } from "./SignUpForm";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.account.signup.meta, robots: { index: false, follow: false } };
}

export default async function Page() {
  const [s, { d }] = await Promise.all([getSiteSettings(), getI18n()]);
  const t = d.account.signup;
  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      {!hasSupabase ? <p className="alert alert-warning">{d.account.demoAccounts}</p> : null}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <SignUpForm termsVersion={String(s["legal.documents_version"])} />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        {t.haveAccount} <Link href="/cuenta/ingresar">{t.signIn}</Link>
      </p>
    </div>
  );
}
