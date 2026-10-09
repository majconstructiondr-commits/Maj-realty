import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, Empty, ExportLink, FileLink, Options, PageHeader, Pagination } from "@/components/admin/Bits";
import { LICENSE_STATUSES, PAYMENT_METHODS, labelOf } from "@/lib/admin/labels";
import { hrefWith, ilikeTerm, oneOf, pageOf, str, type SP } from "@/lib/admin/params";
import { getSetting, labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { isoFromNow, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { createLicense, reviewLicensePayment } from "./actions";

const BASE = "/admin/licencias";
type Lic = {
  id: string; code: string; status: string; starts_at: string | null; ends_at: string | null; holder_user_id: string | null; organization_id: string | null;
  active_listing_quota: number; max_members: number; plans: { name: string } | null; organizations: { name: string } | null;
};
type Pay = { id: string; license_id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null; submitted_by: string; created_at: string; licenses: { code: string } | null };

export default async function AdminLicenses(props: PageProps<"/admin/licencias">) {
  const sp = (await props.searchParams) as SP;
  const { supabase } = await staffCtx(BASE);
  const status = oneOf(sp, "status", Object.keys(LICENSE_STATUSES));
  const vence = str(sp, "vence") === "1";
  const term = ilikeTerm(str(sp, "q"));
  const { page, pageSize, from, to } = pageOf(sp);
  const notice = Number((await getSetting<number>(supabase, "licenses.expiry_notice_days")) ?? 15);

  let q = supabase.from("licenses").select("id, code, status, starts_at, ends_at, holder_user_id, organization_id, active_listing_quota, max_members, plans(name), organizations(name)", { count: "exact" });
  if (status) q = q.eq("status", status);
  if (vence) q = q.eq("status", "activa").gt("ends_at", isoFromNow(0)).lte("ends_at", isoFromNow(notice * 24));
  if (term) q = q.ilike("code", `%${term}%`);
  const [lic, pays, plans, orgs] = await Promise.all([
    q.order(vence ? "ends_at" : "created_at", { ascending: vence }).range(from, to),
    supabase.from("license_payments").select("id, license_id, amount, currency, method, reference, receipt_path, submitted_by, created_at, licenses(code)").eq("status", "pendiente").order("created_at"),
    supabase.from("plans").select("id, name, holder_type, duration_days, price, currency").order("sort_order"),
    supabase.from("organizations").select("id, name, status").order("name").limit(500),
  ]);
  const rows = (lic.data ?? []) as unknown as Lic[];
  const payRows = (pays.data ?? []) as unknown as Pay[];
  const people = await userLabels(supabase, [...rows.map((r) => r.holder_user_id), ...payRows.map((p) => p.submitted_by)]);

  return (
    <>
      <PageHeader title="Licencias y pagos">
        <ExportLink href={hrefWith("/api/admin/export/licencias", sp, { pagina: undefined })}>Exportar CSV</ExportLink>
      </PageHeader>
      <p className="small muted">La licencia es un permiso contractual interno para publicar en MAJ. Al vencer, suspender o cancelar, sus publicaciones activas se pausan automáticamente.</p>

      <section id="pagos" className="card card-body stack" style={{ marginBottom: 16 }}>
        <h2>Pagos pendientes de revisión ({payRows.length})</h2>
        {payRows.length === 0 ? <p className="muted small">No hay pagos pendientes.</p> : payRows.map((p) => (
          <div key={p.id} className="box stack">
            <div>
              <strong>{formatMoney(p.amount, p.currency, { decimals: true })}</strong> · {labelOf(PAYMENT_METHODS, p.method)} {p.reference && `· ref. ${p.reference}`} · licencia <Link href={`${BASE}/${p.license_id}`}>{p.licenses?.code}</Link>
              <div className="xs muted">Enviado por {labelFor(people, p.submitted_by)} el {formatDate(p.created_at, true)} · {p.receipt_path ? <FileLink path={p.receipt_path}>Ver comprobante</FileLink> : "sin comprobante"}</div>
            </div>
            <div className="row">
              <ActionForm action={reviewLicensePayment} submit="Aprobar pago" buttonClass="btn btn-primary btn-sm" inline confirm="¿Confirmar que el pago fue recibido?">
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={p.license_id} /><input type="hidden" name="decision" value="aprobado" />
              </ActionForm>
              <ActionForm action={reviewLicensePayment} submit="Rechazar" buttonClass="btn btn-danger btn-sm" inline>
                <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={p.license_id} /><input type="hidden" name="decision" value="rechazado" />
                <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder="Motivo del rechazo" aria-label="Motivo del rechazo" style={{ maxWidth: 260 }} />
              </ActionForm>
            </div>
          </div>
        ))}
      </section>

      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>Crear licencia</strong></summary>
        <ActionForm action={createLicense} submit="Crear licencia">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="l-p" className="required">Plan</label>
              <select id="l-p" name="plan_id" className="select" required>
                {((plans.data ?? []) as { id: string; name: string; holder_type: string; duration_days: number; price: number | null; currency: Currency }[]).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.holder_type === "organizacion" ? "organización" : "individual"} · {p.duration_days} días · {p.price === null ? "precio por definir" : formatMoney(p.price, p.currency)}</option>
                ))}
              </select>
            </div>
            <div className="field"><label htmlFor="l-e">Titular (correo de la cuenta)</label><input id="l-e" name="holder_email" type="email" className="input" maxLength={160} /></div>
            <div className="field">
              <label htmlFor="l-o">u Organización</label>
              <select id="l-o" name="organization_id" className="select" defaultValue="">
                <option value="">—</option>
                {((orgs.data ?? []) as { id: string; name: string; status: string }[]).map((o) => <option key={o.id} value={o.id}>{o.name} ({o.status})</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="l-s" className="required">Inicio</label><input id="l-s" name="starts_on" type="date" className="input" required defaultValue={localDay(new Date())} /></div>
          </div>
          <label className="check"><input type="checkbox" name="activate" /> Activar ahora (si el pago o acuerdo ya está confirmado)</label>
          <p className="xs muted">La cuota de publicaciones, los miembros y la vigencia se copian del plan.</p>
        </ActionForm>
      </details>

      <form method="get" className="card card-body form-grid" style={{ marginBottom: 16 }} role="search">
        <div className="field"><label htmlFor="f-q">Código</label><input id="f-q" name="q" className="input" defaultValue={str(sp, "q")} /></div>
        <div className="field"><label htmlFor="f-s">Estado</label><select id="f-s" name="status" className="select" defaultValue={status}><Options map={LICENSE_STATUSES} empty="Todos" /></select></div>
        <label className="check"><input type="checkbox" name="vence" value="1" defaultChecked={vence} /> Vencen en {notice} días</label>
        <div className="row"><button className="btn btn-primary" type="submit">Filtrar</button><Link href={BASE} className="btn btn-ghost">Limpiar</Link></div>
      </form>

      {lic.error && <p className="alert alert-error">No se pudo cargar la lista.</p>}
      {rows.length === 0 ? <Empty>No hay licencias.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Código</th><th>Titular</th><th>Plan</th><th>Estado</th><th>Vigencia</th><th>Cuota</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`${BASE}/${r.id}`}><strong>{r.code}</strong></Link></td>
                <td className="small">{r.organizations ? `${r.organizations.name} (organización)` : labelFor(people, r.holder_user_id)}</td>
                <td className="small">{r.plans?.name}</td>
                <td><Badge value={r.status} map={LICENSE_STATUSES} /></td>
                <td className="small">{formatDate(r.starts_at)} – {formatDate(r.ends_at)}</td>
                <td className="small">{r.active_listing_quota} publ. · {r.max_members} miembro(s)</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Pagination base={BASE} sp={sp} page={page} total={lic.count ?? 0} pageSize={pageSize} />
    </>
  );
}
