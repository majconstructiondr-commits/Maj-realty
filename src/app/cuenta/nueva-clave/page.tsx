import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { getI18n } from "@/i18n/server";
import { NewPasswordForm } from "./NewPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.account.newPassword.meta, robots: { index: false, follow: false } };
}

export default async function Page() {
  if (hasSupabase) await requireUser("/cuenta/nueva-clave");
  const { d } = await getI18n();
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>{d.account.newPassword.title}</h1>
      <div className="card card-body" style={{ marginTop: 16 }}>
        <NewPasswordForm />
      </div>
    </div>
  );
}
