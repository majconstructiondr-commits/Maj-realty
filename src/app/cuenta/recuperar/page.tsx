import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ResetForm } from "./ResetForm";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.account.reset.meta, robots: { index: false, follow: false } };
}

export default async function Page() {
  const { d } = await getI18n();
  const t = d.account.reset;
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      <div className="card card-body" style={{ marginTop: 16 }}>
        <ResetForm />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        <Link href="/cuenta/ingresar">{t.back}</Link>
      </p>
    </div>
  );
}
