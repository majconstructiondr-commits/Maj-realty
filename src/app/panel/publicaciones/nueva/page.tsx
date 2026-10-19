import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCreateListings, getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { NewDraftForm } from "@/components/listing-editor/NewDraftForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.editor.newDraft.meta, robots: { index: false, follow: false } };
}

export default async function NewListingPage() {
  await requireUser("/panel/publicaciones/nueva");
  const ctx = (await getSellerContext())!;
  const orgs = ctx.memberships
    .filter((m) => memberCan(m, "publish") && m.organization)
    .map((m) => ({ id: m.organization_id, name: m.organization!.name }));
  const { d } = await getI18n();
  const t = d.editor.newDraft;
  return (
    <div className="section-sm">
      <nav aria-label={d.common.breadcrumb} className="small" style={{ marginBottom: 8 }}>
        <Link href="/panel/publicaciones">{t.back}</Link>
      </nav>
      <h1>{t.title}</h1>
      {canCreateListings(ctx) ? (
        <>
          <p className="muted">
            {t.intro}
          </p>
          <NewDraftForm orgs={orgs} />
        </>
      ) : (
        <p className="alert alert-info">
          {t.notEnabled} <Link href="/panel/publicar">{t.requestLicense}</Link>.
        </p>
      )}
    </div>
  );
}
