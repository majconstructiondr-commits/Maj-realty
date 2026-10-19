import type { Metadata } from "next";
import Link from "next/link";
import "@/components/listing-editor/editor.css";
import { requireUser } from "@/lib/auth";
import type { OPERATIONS, PROPERTY_TYPES, ListingStatus } from "@/lib/catalog/definitions";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { StateBadge, StatusBadge } from "@/components/listing-editor/StatusBadge";
import { AddMemberForm, MemberEditor, OrgDetailsForm, type MemberRow } from "./forms";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.panel.org.meta, robots: { index: false, follow: false } };
}

type Org = { id: string; name: string; legal_name: string | null; rnc: string | null; phone: string | null; email: string | null; status: "pendiente" | "activa" | "suspendida"; created_at: string };
type Listing = { id: string; code: string; title: string; status: ListingStatus; operation: keyof typeof OPERATIONS; property_type: keyof typeof PROPERTY_TYPES; owner_user_id: string; updated_at: string };

export default async function OrganizationPage(props: PageProps<"/panel/organizacion">) {
  const sp = await props.searchParams;
  await requireUser("/panel/organizacion");
  const ctx = (await getSellerContext())!;
  const { d } = await getI18n();
  const t = d.panel.org;
  if (!ctx.memberships.length) {
    return (
      <div className="section-sm">
        <h1>{t.title}</h1>
        <p className="alert alert-info">
          {t.noneBefore} <Link href="/panel/publicar">{t.publishLink}</Link>.{" "}
          {t.noneAfter}
        </p>
      </div>
    );
  }
  const membership = ctx.memberships.find((m) => m.organization_id === sp.org) ?? ctx.memberships[0];
  const orgId = membership.organization_id;
  const canManage = memberCan(membership, "manage_members");
  const canViewAll = memberCan(membership, "view_all");
  const supabase = await createClient();

  let listQ = supabase
    .from("properties")
    .select("id, code, title, status, operation, property_type, owner_user_id, updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!canViewAll) listQ = listQ.eq("owner_user_id", ctx.user.id);
  const [{ data: orgData }, { data: memberData }, { data: licData }, { data: listData }] = await Promise.all([
    supabase.from("organizations").select("id, name, legal_name, rnc, phone, email, status, created_at").eq("id", orgId).maybeSingle(),
    supabase.rpc("org_member_directory", { p_org: orgId }),
    supabase.from("licenses").select("code, status, ends_at, max_members, active_listing_quota").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5),
    listQ,
  ]);
  const org = orgData as Org | null;
  if (!org) {
    return <p className="alert alert-error">{t.loadError}</p>;
  }
  const members = (memberData ?? []) as MemberRow[];
  const licenses = (licData ?? []) as { code: string; status: string; ends_at: string | null; max_members: number; active_listing_quota: number }[];
  const active = licenses.find((l) => l.status === "activa");
  const maxMembers = active?.max_members ?? 1;
  const listings = (listData ?? []) as Listing[];
  const names = new Map(members.map((m) => [m.user_id, m.full_name || m.email || t.member]));
  const addDisabled =
    org.status !== "activa"
      ? t.addWhenActive
      : members.length >= maxMembers
        ? fmt(t.maxMembers, { n: maxMembers })
        : null;

  return (
    <div className="section-sm">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{org.name}</h1>
        <StateBadge value={org.status} />
      </div>
      <p className="small muted">{t.statuses[org.status]} · {fmt(t.yourRole, { role: membership.member_role === "gestor" ? t.manager : t.agent })}</p>

      {ctx.memberships.length > 1 ? (
        <nav aria-label={t.switchAria} className="row" style={{ marginBottom: 12 }}>
          {ctx.memberships.map((m) => (
            <Link key={m.organization_id} className="tab" href={`/panel/organizacion?org=${m.organization_id}`} aria-current={m.organization_id === orgId ? "true" : undefined}>
              {m.organization?.name ?? t.agency}
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-labelledby="org-lic" className="card card-body" style={{ marginTop: 10 }}>
        <h2 id="org-lic" style={{ fontSize: "1.15rem", marginTop: 0 }}>{t.license}</h2>
        {active ? (
          <p style={{ margin: 0 }}>
            {fmt(t.activeLicense, { code: active.code, date: formatDate(active.ends_at), members: active.max_members, quota: active.active_listing_quota })} <Link href="/panel/licencia">{t.viewDetail}</Link>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            {t.noLicense}{licenses[0] ? fmt(t.lastLicense, { code: licenses[0].code, status: (d.editor.badges[licenses[0].status] ?? licenses[0].status).toLowerCase() }) : ""}{t.noLicenseAfter} <Link href="/panel/licencia">{t.viewLicense}</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="org-data" style={{ marginTop: 22 }}>
        <h2 id="org-data" style={{ fontSize: "1.25rem" }}>{t.data}</h2>
        {canManage ? (
          <div className="card card-body"><OrgDetailsForm org={org} /></div>
        ) : (
          <div className="facts">
            <div className="box"><span className="box-label">{t.name}</span><span className="box-value">{org.name}</span></div>
            <div className="box"><span className="box-label">{t.legalName}</span><span className={`box-value${org.legal_name ? "" : " unknown"}`}>{org.legal_name ?? t.notSet}</span></div>
            <div className="box"><span className="box-label">{t.phone}</span><span className={`box-value${org.phone ? "" : " unknown"}`}>{org.phone ?? t.notSet}</span></div>
            <div className="box"><span className="box-label">{t.email}</span><span className={`box-value${org.email ? "" : " unknown"}`}>{org.email ?? t.notSet}</span></div>
          </div>
        )}
      </section>

      <section aria-labelledby="org-members" style={{ marginTop: 22 }}>
        <h2 id="org-members" style={{ fontSize: "1.25rem" }}>{active ? fmt(t.membersOf, { n: members.length, max: maxMembers }) : fmt(t.members, { n: members.length })}</h2>
        {!canManage ? <p className="small muted">{t.managersOnly}</p> : null}
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t.membersCaption}</caption>
            <thead>
              <tr><th scope="col">{t.person}</th><th scope="col">{t.role}</th><th scope="col">{t.permissions}</th>{canManage ? <th scope="col"><span className="sr-only">{t.actions}</span></th> : null}</tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const g = m.member_role === "gestor";
                const perms = [
                  (m.can_publish) && t.permPublish,
                  (g || m.can_view_all_listings) && t.permViewAll,
                  (g || m.can_manage_members) && t.permManage,
                  (g || m.can_view_leads) && t.permLeads,
                ].filter(Boolean);
                return (
                  <tr key={m.user_id}>
                    <td>
                      {m.full_name || t.noName}{m.user_id === ctx.user.id ? t.you : ""}
                      {m.email ? <span className="xs muted" style={{ display: "block" }}>{m.email}</span> : null}
                      <span className="xs muted" style={{ display: "block" }}>{fmt(t.since, { date: formatDate(m.created_at) })}</span>
                    </td>
                    <td className="small">{g ? t.manager : t.agent}</td>
                    <td className="small">{perms.length ? perms.join(" · ") : t.noPerms}</td>
                    {canManage ? (
                      <td><MemberEditor orgId={orgId} m={m} isSelf={m.user_id === ctx.user.id} /></td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManage ? (
          <div className="card card-body" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>{t.addMember}</h3>
            <AddMemberForm orgId={orgId} disabledReason={addDisabled} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="org-portfolio" style={{ marginTop: 22 }}>
        <h2 id="org-portfolio" style={{ fontSize: "1.25rem" }}>{canViewAll ? t.portfolio : t.myListings}</h2>
        {listings.length ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.listingsCaption}</caption>
              <thead>
                <tr><th scope="col">{t.listing}</th><th scope="col">{t.owner}</th><th scope="col">{t.status}</th><th scope="col">{t.updated}</th></tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/panel/publicaciones/${l.id}/editar${canManage || l.owner_user_id === ctx.user.id ? "" : "?paso=8"}`}>{l.title}</Link>
                      <span className="xs muted" style={{ display: "block" }}>{l.code} · {d.labels.propertyTypes[l.property_type]} · {d.labels.operations[l.operation]}</span>
                    </td>
                    <td className="small">{l.owner_user_id === ctx.user.id ? t.youOwner : names.get(l.owner_user_id) ?? t.otherMember}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="small">{formatDate(l.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card empty">{canViewAll ? t.noListings : t.noListingsMine}</p>
        )}
        {memberCan(membership, "publish") ? (
          <p style={{ marginTop: 10 }}><Link className="btn btn-primary btn-sm" href="/panel/publicaciones/nueva">{t.newListing}</Link></p>
        ) : null}
      </section>
    </div>
  );
}
