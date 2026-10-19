import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { UploadForm } from "@/components/admin/UploadForm";
import { staffCtx } from "@/lib/admin/server";
import { createPortfolioItem, deletePortfolioItem, setPortfolioImage, updatePortfolioItem } from "../actions";
import { getI18n } from "@/i18n/server";

type Item = { id: string; title: string; description: string | null; location_summary: string | null; before_path: string | null; after_path: string | null; image_use_authorized: boolean; authorization_reference: string | null; published: boolean; sort_order: number };

export default async function AdminPortfolio() {
  const { supabase } = await staffCtx("/admin/contenido/portafolio");
  const t = (await getI18n()).d.admin.content;
  const { data, error } = await supabase.from("portfolio_items").select("*").order("sort_order").order("created_at");
  const items = (data ?? []) as Item[];
  const url = (p: string | null) => (p ? supabase.storage.from("public-assets").getPublicUrl(p).data.publicUrl : null);
  return (
    <>
      <PageHeader title={t.title} />
      <ContentTabs current="/admin/contenido/portafolio" />
      <p className="small muted">{t.portfolioNote}</p>
      <details className="card card-body" style={{ marginBottom: 16 }}>
        <summary><strong>{t.newWork}</strong></summary>
        <ActionForm action={createPortfolioItem} submit={t.createWork} resetOnSuccess><Fields /></ActionForm>
      </details>
      {error && <p className="alert alert-error">{t.portfolioError}</p>}
      {items.length === 0 && <p className="empty card">{t.noWorks}</p>}
      <div className="stack">
        {items.map((it) => (
          <article key={it.id} className="card card-body stack">
            <h2 style={{ margin: 0 }}>{it.title} {it.published ? <span className="badge badge-success">{t.published}</span> : <span className="badge">{t.notPublished}</span>}</h2>
            <div className="grid-2">
              {(["before_path", "after_path"] as const).map((slot) => (
                <div key={slot} className="box stack">
                  <span className="box-label">{slot === "before_path" ? t.before : t.afterRequired}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url(it[slot]) ? <img src={url(it[slot])!} alt={`${it.title}: ${slot === "before_path" ? t.beforeLower : t.afterLower}`} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} /> : <span className="muted small">{t.noImage}</span>}
                  <UploadForm action={setPortfolioImage} bucket="public-assets" prefix={`portfolio/${it.id}`} kind="image" submit={t.uploadImage}>
                    <input type="hidden" name="id" value={it.id} /><input type="hidden" name="slot" value={slot} />
                  </UploadForm>
                </div>
              ))}
            </div>
            <ActionForm action={updatePortfolioItem} submit={t.save}>
              <input type="hidden" name="id" value={it.id} />
              <Fields it={it} />
              <label className="check"><input type="checkbox" name="published" defaultChecked={it.published} /> {t.publishedOnSite}</label>
            </ActionForm>
            <ActionForm action={deletePortfolioItem} submit={t.deleteWork} buttonClass="btn btn-ghost btn-sm" confirm={t.deleteWorkConfirm}>
              <input type="hidden" name="id" value={it.id} />
            </ActionForm>
          </article>
        ))}
      </div>
    </>
  );
}

async function Fields({ it }: { it?: Item }) {
  const t = (await getI18n()).d.admin.content;
  const k = it?.id ?? "new";
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor={`t-${k}`} className="required">{t.titleField}</label><input id={`t-${k}`} name="title" className="input" required minLength={3} maxLength={160} defaultValue={it?.title ?? ""} /></div>
        <div className="field"><label htmlFor={`l-${k}`}>{t.locationSummary}</label><input id={`l-${k}`} name="location_summary" className="input" maxLength={160} defaultValue={it?.location_summary ?? ""} /></div>
        <div className="field"><label htmlFor={`o-${k}`}>{t.order}</label><input id={`o-${k}`} name="sort_order" type="number" min={0} className="input" defaultValue={it?.sort_order ?? 0} /></div>
        <div className="field"><label htmlFor={`r-${k}`}>{t.authRef}</label><input id={`r-${k}`} name="authorization_reference" className="input" maxLength={300} defaultValue={it?.authorization_reference ?? ""} placeholder={t.authRefPlaceholder} /></div>
      </div>
      <div className="field"><label htmlFor={`d-${k}`}>{t.description}</label><textarea id={`d-${k}`} name="description" className="textarea" maxLength={2000} defaultValue={it?.description ?? ""} /></div>
      <label className="check"><input type="checkbox" name="image_use_authorized" defaultChecked={it?.image_use_authorized ?? false} /> {t.imagesAuthorized}</label>
    </>
  );
}
