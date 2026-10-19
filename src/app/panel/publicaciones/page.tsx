import type { Metadata } from "next";
import Link from "next/link";
import { RentCollectionForm } from "./RentCollectionForm";
import "@/components/listing-editor/editor.css";
import { isStaffRole, requireUser } from "@/lib/auth";
import type { CHANNELS, PROPERTY_TYPES, REQUEST_KINDS, REQUEST_STATUSES, ListingStatus } from "@/lib/catalog/definitions";
import { formatDate, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { canCreateListings, canEditListing, getSellerContext, memberCan } from "@/lib/listing-editor/server";
import { QuickActions } from "@/components/listing-editor/QuickActions";
import { StatusBadge } from "@/components/listing-editor/StatusBadge";
import { listingHref } from "@/components/property/ListingCard";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.editor.list.meta, robots: { index: false, follow: false } };
}

type Row = {
  id: string; code: string; title: string; status: ListingStatus; operation: "venta" | "renta" | "ambas"; property_type: keyof typeof PROPERTY_TYPES;
  province: string; municipality: string; sector: string; rejection_reason: string | null; pause_reason: string | null;
  updated_at: string; owner_user_id: string; organization_id: string | null; first_published_at: string | null; published_at: string | null; slug: string;
};
type Stats = { property_id: string; vistas: number; clics_whatsapp: number; compartidos: number; favoritos: number };
type Lead = {
  id: string; number: string; kind: keyof typeof REQUEST_KINDS; status: keyof typeof REQUEST_STATUSES; contact_name: string; contact_phone: string | null;
  contact_email: string | null; preferred_channel: keyof typeof CHANNELS; property_ref: string | null; message: string | null; created_at: string;
};

// Las etiquetas de cada filtro están en el diccionario (editor.list.filters).
const FILTERS: { key: string; statuses: ListingStatus[] | null }[] = [
  { key: "activas", statuses: ["borrador", "en_revision", "publicado", "pausado", "reservado", "rechazado"] },
  { key: "cerradas", statuses: ["vendido", "rentado", "archivado"] },
  { key: "todas", statuses: null },
];

export default async function PublicationsPage(props: PageProps<"/panel/publicaciones">) {
  const sp = await props.searchParams;
  await requireUser("/panel/publicaciones");
  const ctx = (await getSellerContext())!;
  const me = ctx.user.id;
  const supabase = await createClient();
  const { d } = await getI18n();
  const t = d.editor.list;
  const filter = FILTERS.find((f) => f.key === sp.ver) ?? FILTERS[0];
  const viewAllOrgs = ctx.memberships.filter((m) => memberCan(m, "view_all")).map((m) => m.organization_id);
  const orgNames = new Map(ctx.memberships.map((m) => [m.organization_id, m.organization?.name ?? t.organization]));

  let q = supabase
    .from("properties")
    .select("id, code, slug, title, status, operation, property_type, province, municipality, sector, rejection_reason, pause_reason, updated_at, owner_user_id, organization_id, first_published_at, published_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  q = viewAllOrgs.length ? q.or(`owner_user_id.eq.${me},organization_id.in.(${viewAllOrgs.join(",")})`) : q.eq("owner_user_id", me);
  if (filter.statuses) q = q.in("status", filter.statuses);
  const { data: rowsData, error } = await q;
  const rows = (rowsData ?? []) as Row[];
  const ids = rows.map((r) => r.id);

  const [statsRes, pendingRes, leadsRes, licRes] = await Promise.all([
    ids.length ? supabase.rpc("listing_event_counts", { p_ids: ids }) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("property_change_requests").select("property_id").eq("status", "pendiente").in("property_id", ids) : Promise.resolve({ data: [] }),
    supabase
      .from("service_requests")
      .select("id, number, kind, status, contact_name, contact_phone, contact_email, preferred_channel, property_ref, message, created_at")
      .eq("assigned_publisher_id", me)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("licenses").select("id, code, status, ends_at").eq("status", "activa").gt("ends_at", new Date().toISOString()).limit(5),
  ]);
  const rentIds = rows.filter((r) => r.owner_user_id === me && r.operation !== "venta").map((r) => r.id);
  const [{ data: rentContracts }, { data: feeSetting }] = await Promise.all([
    rentIds.length
      ? supabase.from("management_contracts").select("property_id, status").in("property_id", rentIds).contains("services", ["cobro_rentas"]).in("status", ["borrador", "activo"])
      : Promise.resolve({ data: [] as { property_id: string; status: string }[] }),
    supabase.from("site_settings").select("value").eq("key", "rent.fee_percent").maybeSingle(),
  ]);
  const rentStatus = new Map(((rentContracts ?? []) as { property_id: string; status: string }[]).map((c) => [c.property_id, c.status]));
  const feePercent = Number(feeSetting?.value ?? 5);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  const stats = new Map(((statsRes.data ?? []) as Stats[]).map((s) => [s.property_id, s]));
  const pending = new Set(((pendingRes.data ?? []) as { property_id: string }[]).map((x) => x.property_id));
  const leads = (leadsRes.data ?? []) as Lead[];
  const activeLicenses = (licRes.data ?? []) as { code: string; ends_at: string }[];
  const canCreate = canCreateListings(ctx);
  const enviado = typeof sp.enviado === "string" && /^MAJ-\d{4,}$/.test(sp.enviado) ? sp.enviado : null;

  return (
    <div className="section-sm">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t.title}</h1>
        {canCreate ? <Link className="btn btn-primary" href="/panel/publicaciones/nueva">{t.new}</Link> : null}
      </div>

      {enviado ? (
        <p className="alert alert-success" role="status" style={{ marginTop: 12 }}>
          {fmt(t.sent, { code: enviado })}
        </p>
      ) : null}
      {!canCreate ? (
        <div className="alert alert-info" style={{ marginTop: 12 }}>
          {d.editor.newDraft.notEnabled} <Link href="/panel/publicar">{d.editor.newDraft.requestLicense}</Link>.
        </div>
      ) : isStaffRole(ctx.user) ? (
        <p className="small muted" style={{ marginTop: 8 }}>
          {t.staff}
        </p>
      ) : !activeLicenses.length ? (
        <p className="alert alert-warning small" style={{ marginTop: 12 }}>
          {t.noLicense} <Link href="/panel/licencia">{t.viewLicense}</Link>
        </p>
      ) : (
        <p className="small muted" style={{ marginTop: 8 }}>
          {fmt(t.activeLicense, { list: activeLicenses.map((l) => fmt(t.licenseItem, { code: l.code, date: formatDate(l.ends_at) })).join(", ") })} <Link href="/panel/licencia">{t.viewQuotas}</Link>
        </p>
      )}

      <nav aria-label={t.filterAria} className="row" style={{ margin: "14px 0" }}>
        {FILTERS.map((f) => (
          <Link key={f.key} className="tab" href={`/panel/publicaciones?ver=${f.key}`} aria-current={f.key === filter.key ? "true" : undefined}>{t.filters[f.key]}</Link>
        ))}
      </nav>

      {error ? <p className="alert alert-error">{t.error}</p> : null}
      {!rows.length && !error ? (
        <div className="card empty">
          <p>{t.empty}</p>
          {canCreate ? <Link className="btn btn-primary" href="/panel/publicaciones/nueva">{t.createFirst}</Link> : null}
        </div>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const s = stats.get(r.id);
          const canEdit = canEditListing(ctx, r);
          return (
            <li key={r.id} className="card le-listing">
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <span className="xs muted">
                    {r.code} · {d.labels.propertyTypes[r.property_type]} · {d.labels.operations[r.operation]}
                    {r.organization_id ? ` · ${orgNames.get(r.organization_id) ?? t.organization}` : ""}
                    {r.owner_user_id !== me ? t.otherMember : ""}
                  </span>
                  <h2 style={{ fontSize: "1.1rem", margin: "2px 0", fontFamily: "var(--font-sans)", overflowWrap: "anywhere" }}>{r.title}</h2>
                  <span className="small muted">{[r.sector, r.municipality, r.province].filter(Boolean).join(", ") || t.noLocation}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge status={r.status} />
                  {pending.has(r.id) ? <span className="badge badge-warning">{t.changeInReview}</span> : null}
                </div>
              </div>
              {r.status === "rechazado" && r.rejection_reason ? (
                <p className="alert alert-error small" style={{ margin: 0 }}><strong>{t.rejection}</strong> {r.rejection_reason}</p>
              ) : null}
              {r.status === "pausado" && r.pause_reason ? (
                <p className="alert alert-warning small" style={{ margin: 0 }}><strong>{t.paused}</strong> {r.pause_reason}</p>
              ) : null}
              <div className="le-stats">
                <span>{t.views} <strong>{formatNumber(s?.vistas ?? 0)}</strong></span>
                <span>{t.whatsappClicks} <strong>{formatNumber(s?.clics_whatsapp ?? 0)}</strong></span>
                <span>{t.shares} <strong>{formatNumber(s?.compartidos ?? 0)}</strong></span>
                <span>{fmt(t.updated, { date: formatDate(r.updated_at) })}</span>
                {r.status === "publicado" || r.status === "reservado" ? (
                  <Link href={listingHref(r)}>{t.publicPage}</Link>
                ) : null}
              </div>
              <QuickActions
                id={r.id}
                status={r.status}
                operation={r.operation}
                title={r.title}
                canEdit={canEdit}
                canDuplicate={canCreate}
                canDelete={r.owner_user_id === me && r.status === "borrador" && !r.first_published_at}
              />
              {rentIds.includes(r.id) ? (
                rentStatus.has(r.id) ? (
                  <p className="small" style={{ margin: 0 }}>
                    <strong>{t.rentByMaj}</strong> {rentStatus.get(r.id) === "activo" ? <>{t.rentActive} · <Link href="/panel/administracion">{t.viewCharges}</Link></> : t.rentInReview}
                  </p>
                ) : (
                  <details>
                    <summary className="small"><strong>{fmt(t.rentOffer, { pct: feePercent })}</strong></summary>
                    <RentCollectionForm propertyId={r.id} feePercent={feePercent} today={today} />
                  </details>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="xs muted" style={{ marginTop: 10 }}>
        {t.statsNote}
      </p>

      <section aria-labelledby="leads-title" style={{ marginTop: 28 }}>
        <h2 id="leads-title">{t.leads}</h2>
        <p className="small muted">{t.leadsIntro}</p>
        {leads.length ? (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{t.leadsCaption}</caption>
              <thead>
                <tr><th scope="col">{t.request}</th><th scope="col">{t.contact}</th><th scope="col">{t.property}</th><th scope="col">{t.status}</th><th scope="col">{t.date}</th></tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.number}</strong>
                      <span className="small" style={{ display: "block" }}>{d.status.requestKinds[l.kind] ?? l.kind}</span>
                      {l.message ? <span className="xs muted" style={{ display: "block", maxWidth: 320, whiteSpace: "pre-line" }}>{l.message.slice(0, 280)}{l.message.length > 280 ? "…" : ""}</span> : null}
                    </td>
                    <td className="small">
                      {l.contact_name}
                      {l.contact_phone ? <span style={{ display: "block" }}><a href={`tel:${l.contact_phone.replace(/[^\d+]/g, "")}`}>{l.contact_phone}</a></span> : null}
                      {l.contact_email ? <span style={{ display: "block" }}><a href={`mailto:${l.contact_email}`}>{l.contact_email}</a></span> : null}
                      <span className="xs muted">{fmt(t.prefers, { channel: d.labels.channels[l.preferred_channel] ?? l.preferred_channel })}</span>
                    </td>
                    <td className="small">{l.property_ref ?? "—"}</td>
                    <td><span className="badge">{d.status.requestStatuses[l.status] ?? l.status}</span></td>
                    <td className="small">{formatDate(l.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card empty">{t.noLeads}</p>
        )}
      </section>
      <p className="xs muted" style={{ marginTop: 16 }}>{fmt(t.statuses, { list: Object.values(d.status.listing).join(" · ") })}</p>
    </div>
  );
}
