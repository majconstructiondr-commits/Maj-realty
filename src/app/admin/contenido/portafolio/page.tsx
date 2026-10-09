import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { UploadForm } from "@/components/admin/UploadForm";
import { staffCtx } from "@/lib/admin/server";
import { createPortfolioItem, deletePortfolioItem, setPortfolioImage, updatePortfolioItem } from "../actions";

type Item = { id: string; title: string; description: string | null; location_summary: string | null; before_path: string | null; after_path: string | null; image_use_authorized: boolean; authorization_reference: string | null; published: boolean; sort_order: number };

export default async function AdminPortfolio() {
  const { supabase } = await staffCtx("/admin/contenido/portafolio");
  const { data, error } = await supabase.from("portfolio_items").select("*").order("sort_order").order("created_at");
  const items = (data ?? []) as Item[];
  const url = (p: string | null) => (p ? supabase.storage.from("public-assets").getPublicUrl(p).data.publicUrl : null);
  return (
    <>
      <PageHeader title="Contenido y portafolio" />
      <ContentTabs current="/admin/contenido/portafolio" />
      <p className="small muted">Solo publique trabajos con autorización expresa del cliente para usar las imágenes. Las imágenes se suben al almacenamiento público.</p>
      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>+ Nuevo trabajo</strong></summary>
        <ActionForm action={createPortfolioItem} submit="Crear trabajo" resetOnSuccess><Fields /></ActionForm>
      </details>
      {error && <p className="alert alert-error">No se pudo cargar el portafolio.</p>}
      {items.length === 0 && <p className="empty card">Sin trabajos en el portafolio.</p>}
      <div className="stack">
        {items.map((it) => (
          <article key={it.id} className="card card-body stack">
            <h2 style={{ margin: 0 }}>{it.title} {it.published ? <span className="badge badge-success">Publicado</span> : <span className="badge">No publicado</span>}</h2>
            <div className="grid-2">
              {(["before_path", "after_path"] as const).map((slot) => (
                <div key={slot} className="box stack">
                  <span className="box-label">{slot === "before_path" ? "Antes" : "Después (obligatoria para publicar)"}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url(it[slot]) ? <img src={url(it[slot])!} alt={`${it.title}: ${slot === "before_path" ? "antes" : "después"}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} /> : <span className="muted small">Sin imagen</span>}
                  <UploadForm action={setPortfolioImage} bucket="public-assets" prefix={`portfolio/${it.id}`} kind="image" submit="Subir imagen">
                    <input type="hidden" name="id" value={it.id} /><input type="hidden" name="slot" value={slot} />
                  </UploadForm>
                </div>
              ))}
            </div>
            <ActionForm action={updatePortfolioItem} submit="Guardar">
              <input type="hidden" name="id" value={it.id} />
              <Fields it={it} />
              <label className="check"><input type="checkbox" name="published" defaultChecked={it.published} /> Publicado en el sitio</label>
            </ActionForm>
            <ActionForm action={deletePortfolioItem} submit="Eliminar trabajo" buttonClass="btn btn-ghost btn-sm" confirm="¿Eliminar este trabajo del portafolio?">
              <input type="hidden" name="id" value={it.id} />
            </ActionForm>
          </article>
        ))}
      </div>
    </>
  );
}

function Fields({ it }: { it?: Item }) {
  const k = it?.id ?? "new";
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor={`t-${k}`} className="required">Título</label><input id={`t-${k}`} name="title" className="input" required minLength={3} maxLength={160} defaultValue={it?.title ?? ""} /></div>
        <div className="field"><label htmlFor={`l-${k}`}>Ubicación (resumen)</label><input id={`l-${k}`} name="location_summary" className="input" maxLength={160} defaultValue={it?.location_summary ?? ""} /></div>
        <div className="field"><label htmlFor={`o-${k}`}>Orden</label><input id={`o-${k}`} name="sort_order" type="number" min={0} className="input" defaultValue={it?.sort_order ?? 0} /></div>
        <div className="field"><label htmlFor={`r-${k}`}>Referencia de la autorización</label><input id={`r-${k}`} name="authorization_reference" className="input" maxLength={300} defaultValue={it?.authorization_reference ?? ""} placeholder="Documento firmado, fecha, persona" /></div>
      </div>
      <div className="field"><label htmlFor={`d-${k}`}>Descripción</label><textarea id={`d-${k}`} name="description" className="textarea" maxLength={2000} defaultValue={it?.description ?? ""} /></div>
      <label className="check"><input type="checkbox" name="image_use_authorized" defaultChecked={it?.image_use_authorized ?? false} /> El cliente autorizó el uso de las imágenes</label>
    </>
  );
}
