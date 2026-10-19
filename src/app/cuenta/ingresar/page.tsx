import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.account.login.meta, robots: { index: false, follow: false } };
}

const NOTICE_KINDS: Record<string, "error" | "success" | "info"> = { enlace: "error", confirmado: "success", salida: "info" };

export default async function Page(props: PageProps<"/cuenta/ingresar">) {
  const sp = await props.searchParams;
  const { d } = await getI18n();
  const t = d.account.login;
  const next = safeNext(Array.isArray(sp.siguiente) ? sp.siguiente[0] : sp.siguiente, "/panel");
  const key = String(sp.aviso ?? sp.error ?? "");
  const notice = NOTICE_KINDS[key] ? { kind: NOTICE_KINDS[key], text: t.notices[key as keyof typeof t.notices] } : undefined;
  if (await getSessionUser()) redirect(next);
  return (
    <div className="container section" style={{ maxWidth: 480 }}>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      {notice ? <p className={`alert alert-${notice.kind}`} role="status">{notice.text}</p> : null}
      {!hasSupabase ? <p className="alert alert-warning">{d.account.demoAccounts}</p> : null}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <LoginForm next={next} />
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        {t.noAccount} <Link href={`/cuenta/registro${next !== "/panel" ? `?siguiente=${encodeURIComponent(next)}` : ""}`}>{t.createAccount}</Link>
      </p>
    </div>
  );
}
