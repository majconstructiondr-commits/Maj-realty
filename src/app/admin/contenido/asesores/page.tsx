import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { UploadForm } from "@/components/admin/UploadForm";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { createAdvisor, setAdvisorPhoto, updateAdvisor } from "../actions";

type Adv = { id: string; user_id: string | null; display_name: string; title: string | null; whatsapp: string | null; photo_path: string | null; bio: string | null; show_on_team_page: boolean; is_active: boolean; sort_order: number };

export default async function AdminAdvisors() {
  const { supabase, isAdmin } = await staffCtx("/admin/contenido/asesores");
  const { data, error } = await supabase.from("advisors").select("*").order("sort_order");
  const rows = (data ?? []) as Adv[];
  const people = await userLabels(supabase, rows.map((r) => r.user_id));
  const url = (p: string | null) => (p ? supabase.storage.from("public-assets").getPublicUrl(p).data.publicUrl : null);
  return (
    <>
      <PageHeader title="Contenido y portafolio" />
      <ContentTabs current="/admin/contenido/asesores" />
      <p className="small muted">Asesores autorizados: destino de WhatsApp por inmueble (si la regla lo indica) y página de equipo. Solo muestre en el equipo personas reales con foto y datos autorizados.</p>
      {!isAdmin && <p className="alert alert-info small">Solo los administradores pueden crear o modificar asesores.</p>}
      {isAdmin && (
        <details className="card card-body" style={{ marginBottom: 16 }}>
          <summary><strong>+ Nuevo asesor</strong></summary>
          <ActionForm action={createAdvisor} submit="Crear asesor" resetOnSuccess><Fields /></ActionForm>
        </details>
      )}
      {error && <p className="alert alert-error">No se pudieron cargar los asesores.</p>}
      <div className="stack">
        {rows.map((a) => (
          <article key={a.id} className="card card-body stack">
            <div className="row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url(a.photo_path) ? <img src={url(a.photo_path)!} alt={a.display_name} width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} /> : null}
              <h2 style={{ margin: 0 }}>{a.display_name}</h2>
              {a.is_active ? <span className="badge badge-success">Activo</span> : <span className="badge">Inactivo</span>}
              {a.show_on_team_page && <span className="badge badge-gold">En página de equipo</span>}
            </div>
            <p className="small">{a.title} {a.whatsapp && `· WhatsApp ${a.whatsapp}`} {a.user_id && `· cuenta: ${labelFor(people, a.user_id)}`}</p>
            {isAdmin && (
              <>
                <UploadForm action={setAdvisorPhoto} bucket="public-assets" prefix={`team/${a.id}`} kind="image" submit="Subir foto" fileLabel="Foto (real y autorizada)">
                  <input type="hidden" name="id" value={a.id} />
                </UploadForm>
                <ActionForm action={updateAdvisor} submit="Guardar">
                  <input type="hidden" name="id" value={a.id} />
                  <Fields a={a} />
                  {a.user_id && <label className="check"><input type="checkbox" name="unlink_user" /> Desvincular cuenta ({people.get(a.user_id)?.email})</label>}
                </ActionForm>
              </>
            )}
          </article>
        ))}
        {rows.length === 0 && <p className="empty card">No hay asesores registrados.</p>}
      </div>
    </>
  );
}

function Fields({ a }: { a?: Adv }) {
  const k = a?.id ?? "new";
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor={`n-${k}`} className="required">Nombre</label><input id={`n-${k}`} name="display_name" className="input" required minLength={2} maxLength={80} defaultValue={a?.display_name ?? ""} /></div>
        <div className="field"><label htmlFor={`t-${k}`}>Cargo</label><input id={`t-${k}`} name="title" className="input" maxLength={80} defaultValue={a?.title ?? ""} /></div>
        <div className="field"><label htmlFor={`w-${k}`}>WhatsApp</label><input id={`w-${k}`} name="whatsapp" className="input" inputMode="numeric" maxLength={20} defaultValue={a?.whatsapp ?? ""} placeholder="18095551234" /><span className="hint">Solo dígitos con código de país.</span></div>
        <div className="field"><label htmlFor={`e-${k}`}>Vincular cuenta (correo)</label><input id={`e-${k}`} name="user_email" type="email" className="input" maxLength={160} /><span className="hint">Para asignarle visitas y conversaciones.</span></div>
        <div className="field"><label htmlFor={`o-${k}`}>Orden</label><input id={`o-${k}`} name="sort_order" type="number" min={0} className="input" defaultValue={a?.sort_order ?? 0} /></div>
      </div>
      <div className="field"><label htmlFor={`b-${k}`}>Biografía breve</label><textarea id={`b-${k}`} name="bio" className="textarea" maxLength={600} defaultValue={a?.bio ?? ""} /></div>
      <label className="check"><input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} /> Activo</label>
      <label className="check"><input type="checkbox" name="show_on_team_page" defaultChecked={a?.show_on_team_page ?? false} /> Mostrar en la página de equipo (requiere foto real autorizada)</label>
    </>
  );
}
