import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Badge, FileLink, PageHeader } from "@/components/admin/Bits";
import { LICENSE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, STATUSES, labelOf } from "@/lib/admin/labels";
import { isUuid } from "@/lib/admin/params";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { addDays, localDay } from "@/lib/admin/time";
import { formatDate, formatMoney, type Currency } from "@/lib/format";
import { activateLicense, changeLicenseStatus, reviewLicensePayment } from "../actions";

type Pay = { id: string; amount: number; currency: Currency; method: string; reference: string | null; receipt_path: string | null; status: string; review_reason: string | null; submitted_by: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string };

export default async function LicenseDetail(props: PageProps<"/admin/licencias/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const { supabase } = await staffCtx(`/admin/licencias/${id}`);
  const { data: l } = await supabase.from("licenses").select("*, plans(name, duration_days, active_listing_quota, max_members), organizations(id, name, status)").eq("id", id).maybeSingle();
  if (!l) notFound();
  const [pays, props_] = await Promise.all([
    supabase.from("license_payments").select("*").eq("license_id", id).order("created_at", { ascending: false }),
    supabase.from("properties").select("id, code, title, status").eq("license_id", id).order("updated_at", { ascending: false }).limit(100),
  ]);
  const payRows = (pays.data ?? []) as Pay[];
  const people = await userLabels(supabase, [l.holder_user_id as string | null, l.activated_by as string | null, ...payRows.flatMap((p) => [p.submitted_by, p.reviewed_by])]);
  const plan = l.plans as { name: string; duration_days: number; active_listing_quota: number; max_members: number } | null;
  const org = l.organizations as { id: string; name: string; status: string } | null;
  const live = ((props_.data ?? []) as { status: string }[]).filter((p) => ["en_revision", "publicado", "reservado"].includes(p.status)).length;
  const today = localDay(new Date());
  const startDefault = l.starts_at && new Date(l.ends_at as string) > new Date() ? localDay(l.starts_at as string) : today;
  const endDefault = l.ends_at && new Date(l.ends_at as string) > new Date() ? localDay(l.ends_at as string) : addDays(startDefault, plan?.duration_days ?? 365);

  return (
    <>
      <PageHeader title={`Licencia ${l.code}`} back={{ href: "/admin/licencias", label: "Licencias" }}>
        <Badge value={l.status as string} map={LICENSE_STATUSES} />
      </PageHeader>
      <div className="grid-2">
        <section className="card card-body stack">
          <h2>Datos</h2>
          <p className="small">
            Titular: {org ? <>{org.name} (organización · {org.status})</> : <>{labelFor(people, l.holder_user_id as string)} {people.get(l.holder_user_id as string)?.email && `· ${people.get(l.holder_user_id as string)?.email}`} · <Link href={`/admin/usuarios/${l.holder_user_id}`}>ver usuario</Link></>}<br />
            Plan: {plan?.name}<br />
            Vigencia: {formatDate(l.starts_at as string)} – {formatDate(l.ends_at as string)}<br />
            Cuota: {live} de {l.active_listing_quota as number} publicaciones activas · {l.max_members as number} miembro(s)<br />
            {l.status_reason && <>Motivo de estado: {l.status_reason as string}<br /></>}
            {l.activated_by && <>Activada por {labelFor(people, l.activated_by as string)}</>}
          </p>
        </section>
        <section className="card card-body stack">
          <h2>{l.status === "activa" ? "Ajustar vigencia" : "Activar / renovar"}</h2>
          {l.status !== "cancelada" ? (
            <ActionForm action={activateLicense} submit={l.status === "activa" ? "Guardar vigencia" : "Activar licencia"} confirm="¿Confirmar las fechas de vigencia?">
              <input type="hidden" name="id" value={id} />
              <div className="form-grid">
                <div className="field"><label htmlFor="a-s" className="required">Inicio</label><input id="a-s" type="date" name="starts_on" className="input" required defaultValue={startDefault} /></div>
                <div className="field"><label htmlFor="a-e" className="required">Fin</label><input id="a-e" type="date" name="ends_on" className="input" required defaultValue={endDefault} /></div>
              </div>
              <label className="check"><input type="checkbox" name="refresh_quota" /> Actualizar cuota y miembros desde el plan actual</label>
            </ActionForm>
          ) : <p className="muted small">Licencia cancelada: cree una nueva si corresponde.</p>}
          {["activa", "pendiente", "vencida", "suspendida"].includes(l.status as string) && (
            <ActionForm action={changeLicenseStatus} submit="Aplicar" buttonClass="btn btn-danger btn-sm">
              <input type="hidden" name="id" value={id} />
              <div className="form-grid">
                <div className="field"><label htmlFor="s-s">Acción</label><select id="s-s" name="status" className="select">{l.status !== "suspendida" && <option value="suspendida">Suspender</option>}<option value="cancelada">Cancelar</option></select></div>
                <div className="field"><label htmlFor="s-r" className="required">Motivo</label><input id="s-r" name="reason" className="input" required minLength={3} maxLength={2000} /></div>
              </div>
            </ActionForm>
          )}
        </section>
      </div>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Pagos</h2>
        {payRows.length === 0 ? <p className="muted small">Sin pagos registrados.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Comprobante</th><th>Estado</th><th>Revisión</th></tr></thead>
              <tbody>{payRows.map((p) => (
                <tr key={p.id}>
                  <td className="small">{formatDate(p.created_at, true)}<div className="xs muted">{labelFor(people, p.submitted_by)}</div></td>
                  <td>{formatMoney(p.amount, p.currency, { decimals: true })}</td>
                  <td className="small">{labelOf(PAYMENT_METHODS, p.method)}{p.reference && <div className="xs">ref. {p.reference}</div>}</td>
                  <td className="small">{p.receipt_path ? <FileLink path={p.receipt_path}>Descargar</FileLink> : "—"}</td>
                  <td><Badge value={p.status} map={PAYMENT_STATUSES} />{p.review_reason && <div className="xs">{p.review_reason}</div>}</td>
                  <td>
                    {p.status === "pendiente" ? (
                      <div className="stack">
                        <ActionForm action={reviewLicensePayment} submit="Aprobar" buttonClass="btn btn-primary btn-sm" confirm="¿Confirmar que el pago fue recibido?">
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={id} /><input type="hidden" name="decision" value="aprobado" />
                        </ActionForm>
                        <ActionForm action={reviewLicensePayment} submit="Rechazar" buttonClass="btn btn-danger btn-sm">
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="license_id" value={id} /><input type="hidden" name="decision" value="rechazado" />
                          <input name="reason" className="input" required minLength={3} maxLength={2000} placeholder="Motivo" aria-label="Motivo del rechazo" />
                        </ActionForm>
                      </div>
                    ) : <span className="xs muted">{labelFor(people, p.reviewed_by)} · {formatDate(p.reviewed_at, true)}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-body stack" style={{ marginTop: 16 }}>
        <h2>Publicaciones con esta licencia</h2>
        {(props_.data ?? []).length === 0 ? <p className="muted small">Ninguna.</p> : (
          <ul>{((props_.data ?? []) as { id: string; code: string; title: string; status: string }[]).map((p) => (
            <li key={p.id}><Link href={`/admin/inmuebles/${p.id}`}>{p.code}</Link> · {p.title} · {labelOf(STATUSES, p.status)}</li>
          ))}</ul>
        )}
      </section>
    </>
  );
}
