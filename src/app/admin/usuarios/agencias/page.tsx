import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, Options, PageHeader, Pagination, SubNav } from "@/components/admin/Bits";
import { ORG_STATUSES, labelOf } from "@/lib/admin/labels";
import { ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { formatDate } from "@/lib/format";
import { setOrganizationStatus } from "../actions";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

const BASE = "/admin/usuarios/agencias";
type Org = {
  id: string; name: string; legal_name: string | null; rnc: string | null; phone: string | null; email: string | null; status: string; created_by: string; created_at: string;
  organization_members: { user_id: string; member_role: string }[]; licenses: { id: string; code: string; status: string }[];
};

export default async function AdminOrganizations(props: PageProps<"/admin/usuarios/agencias">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const i = (await getI18n()).d;
  const c = i.admin.common;
  const t = i.admin.users;
  const TABS = [{ href: "/admin/usuarios", label: t.tabUsers }, { href: BASE, label: t.tabOrgs }];
  const status = oneOf(sp, "status", Object.keys(ORG_STATUSES));
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  let q = supabase.from("organizations").select("id, name, legal_name, rnc, phone, email, status, created_by, created_at, organization_members(user_id, member_role), licenses(id, code, status)", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (term) q = q.or(`name.ilike.%${term}%,legal_name.ilike.%${term}%,rnc.ilike.%${term}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, to);
  const rows = (data ?? []) as unknown as Org[];
  const people = await userLabels(supabase, rows.flatMap((o) => [o.created_by, ...o.organization_members.map((m) => m.user_id)]));
  return (
    <>
      <PageHeader title={t.title} />
      <SubNav items={TABS} current={BASE} />
      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="o-q">{c.search}</label><input id="o-q" name="q" className="input" defaultValue={str(sp, "q")} placeholder={t.orgSearchPlaceholder} /></div>
        <div className="field"><label htmlFor="o-s">{c.status}</label><select id="o-s" name="status" className="select" defaultValue={status}><Options map={i.status.org} empty={c.all} /></select></div>
        <div className="row"><button className="btn btn-primary" type="submit">{c.filter}</button><Link href={BASE} className="btn btn-ghost">{c.clear}</Link></div>
      </form>
      {error && <p className="alert alert-error">{c.loadError}</p>}
      {rows.length === 0 ? <Empty>{t.noOrgs}</Empty> : rows.map((o) => (
        <article key={o.id} className="card card-body stack" style={{ marginBottom: 12 }}>
          <div className="row-between">
            <h2 style={{ margin: 0 }}>{o.name} <Badge value={o.status} map={i.status.org} /></h2>
            <ActionForm action={setOrganizationStatus} submit={t.change} buttonClass="btn btn-ghost btn-sm" inline confirm={t.orgSuspendConfirm}>
              <input type="hidden" name="id" value={o.id} />
              <select name="status" className="select" aria-label={c.status} defaultValue={o.status} style={{ maxWidth: 160 }}><Options map={i.status.org} /></select>
            </ActionForm>
          </div>
          <p className="small">
            {[o.legal_name, o.rnc && `RNC ${o.rnc}`, o.phone, o.email].filter(Boolean).join(" · ") || t.noTaxData} · {fmt(t.createdOn, { date: formatDate(o.created_at) })} <Link href={`/admin/usuarios/${o.created_by}`}>{labelFor(people, o.created_by)}</Link>
          </p>
          <p className="small">{fmt(t.members, { n: o.organization_members.length })} {o.organization_members.map((m) => <Link key={m.user_id} href={`/admin/usuarios/${m.user_id}`} style={{ marginRight: 6 }}>{labelFor(people, m.user_id)} ({m.member_role})</Link>)}</p>
          <p className="small">{t.licensesLabel} {o.licenses.length ? o.licenses.map((l) => <Link key={l.id} href={`/admin/licencias/${l.id}`} style={{ marginRight: 6 }}>{l.code} ({labelOf(i.status.license, l.status)})</Link>) : t.noneLower}</p>
        </article>
      ))}
      <Pagination base={BASE} sp={sp} page={page} total={count ?? 0} pageSize={pageSize} />
    </>
  );
}
