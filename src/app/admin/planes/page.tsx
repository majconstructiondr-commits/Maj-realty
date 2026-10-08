import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { adminCtx } from "@/lib/admin/server";
import { formatMoney, type Currency } from "@/lib/format";
import { savePlan } from "./actions";

type Plan = {
  id: string; code: string; name: string; description: string | null; holder_type: string; price: number | null; currency: Currency;
  duration_days: number; active_listing_quota: number; max_members: number; is_active: boolean; sort_order: number;
};

export default async function AdminPlans() {
  const { supabase } = await adminCtx("/admin/planes");
  const { data, error } = await supabase.from("plans").select("*").order("sort_order");
  const plans = (data ?? []) as Plan[];
  return (
    <>
      <PageHeader title="Planes de publicación" />
      <p className="small muted">
        Precio vacío = “por definir” (no se muestra un precio inventado). Las cuotas y miembros se copian a cada licencia al crearla o renovarla.
        La “licencia” es un permiso contractual interno para publicar en MAJ, no una licencia profesional ni gubernamental.
      </p>
      {error && <p className="alert alert-error">No se pudieron cargar los planes.</p>}
      <div className="stack">
        {plans.map((p) => (
          <section key={p.id} className="card card-body stack">
            <h2 style={{ margin: 0 }}>{p.name} <span className="badge">{p.code}</span> <span className="badge">{p.holder_type === "organizacion" ? "Organización" : "Individual"}</span></h2>
            <p className="small">Precio actual: {p.price === null ? <strong>Por definir</strong> : formatMoney(p.price, p.currency, { decimals: true })} · {p.is_active ? "Activo" : "Inactivo"}</p>
            <ActionForm action={savePlan} submit="Guardar plan">
              <input type="hidden" name="id" value={p.id} />
              <div className="form-grid">
                <div className="field"><label htmlFor={`n-${p.id}`} className="required">Nombre</label><input id={`n-${p.id}`} name="name" className="input" required maxLength={80} defaultValue={p.name} /></div>
                <div className="field"><label htmlFor={`p-${p.id}`}>Precio (vacío = por definir)</label><input id={`p-${p.id}`} name="price" type="number" min="0" step="0.01" className="input" defaultValue={p.price ?? ""} /></div>
                <div className="field"><label htmlFor={`c-${p.id}`}>Moneda</label><select id={`c-${p.id}`} name="currency" className="select" defaultValue={p.currency}><option value="DOP">DOP</option><option value="USD">USD</option></select></div>
                <div className="field"><label htmlFor={`d-${p.id}`} className="required">Duración (días)</label><input id={`d-${p.id}`} name="duration_days" type="number" min={1} max={3660} className="input" required defaultValue={p.duration_days} /></div>
                <div className="field"><label htmlFor={`q-${p.id}`} className="required">Publicaciones activas</label><input id={`q-${p.id}`} name="active_listing_quota" type="number" min={0} className="input" required defaultValue={p.active_listing_quota} /></div>
                <div className="field"><label htmlFor={`m-${p.id}`} className="required">Miembros</label><input id={`m-${p.id}`} name="max_members" type="number" min={1} className="input" required defaultValue={p.max_members} /></div>
                <div className="field"><label htmlFor={`o-${p.id}`}>Orden</label><input id={`o-${p.id}`} name="sort_order" type="number" min={0} className="input" defaultValue={p.sort_order} /></div>
              </div>
              <div className="field"><label htmlFor={`x-${p.id}`}>Descripción</label><textarea id={`x-${p.id}`} name="description" className="textarea" maxLength={1000} defaultValue={p.description ?? ""} /></div>
              <label className="check"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> Plan activo (visible para solicitar)</label>
            </ActionForm>
          </section>
        ))}
      </div>
    </>
  );
}
