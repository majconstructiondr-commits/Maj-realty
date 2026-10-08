import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { staffCtx } from "@/lib/admin/server";
import { saveLegalService } from "../actions";

type Svc = { code: string; name: string; description: string | null; enabled: boolean; responsible_professional: string | null; sort_order: number };

export default async function AdminLegalServices() {
  const { supabase, isAdmin } = await staffCtx("/admin/contenido/legales");
  const { data, error } = await supabase.from("legal_services").select("*").order("sort_order");
  const rows = (data ?? []) as Svc[];
  return (
    <>
      <PageHeader title="Contenido y portafolio" />
      <ContentTabs current="/admin/contenido/legales" />
      <p className="small muted">Un servicio legal solo puede habilitarse con un profesional competente responsable (la base de datos lo exige). Deshabilitado, no se ofrece ni acepta solicitudes.</p>
      {!isAdmin && <p className="alert alert-info small">Solo los administradores pueden modificar los servicios legales.</p>}
      {error && <p className="alert alert-error">No se pudieron cargar los servicios.</p>}
      <div className="stack">
        {rows.map((s) => (
          <article key={s.code} className="card card-body stack">
            <h2 style={{ margin: 0 }}>{s.name} {s.enabled ? <span className="badge badge-success">Habilitado</span> : <span className="badge">Deshabilitado</span>}</h2>
            {isAdmin ? (
              <ActionForm action={saveLegalService} submit="Guardar">
                <input type="hidden" name="code" value={s.code} />
                <div className="form-grid">
                  <div className="field"><label htmlFor={`n-${s.code}`} className="required">Nombre</label><input id={`n-${s.code}`} name="name" className="input" required maxLength={120} defaultValue={s.name} /></div>
                  <div className="field"><label htmlFor={`r-${s.code}`}>Profesional responsable</label><input id={`r-${s.code}`} name="responsible_professional" className="input" maxLength={160} defaultValue={s.responsible_professional ?? ""} placeholder="Nombre y colegiatura" /></div>
                  <div className="field"><label htmlFor={`o-${s.code}`}>Orden</label><input id={`o-${s.code}`} name="sort_order" type="number" min={0} className="input" defaultValue={s.sort_order} /></div>
                </div>
                <div className="field"><label htmlFor={`d-${s.code}`}>Descripción</label><textarea id={`d-${s.code}`} name="description" className="textarea" maxLength={1000} defaultValue={s.description ?? ""} /></div>
                <label className="check"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Habilitado (requiere profesional responsable)</label>
              </ActionForm>
            ) : <p className="small">{s.description} {s.responsible_professional && `· Responsable: ${s.responsible_professional}`}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
