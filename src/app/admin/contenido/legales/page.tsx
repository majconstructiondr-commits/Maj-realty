import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { staffCtx } from "@/lib/admin/server";
import { saveLegalService } from "../actions";
import { getI18n } from "@/i18n/server";

type Svc = { code: string; name: string; description: string | null; enabled: boolean; responsible_professional: string | null; sort_order: number };

export default async function AdminLegalServices() {
  const { supabase, isAdmin } = await staffCtx("/admin/contenido/legales");
  const t = (await getI18n()).d.admin.content;
  const { data, error } = await supabase.from("legal_services").select("*").order("sort_order");
  const rows = (data ?? []) as Svc[];
  return (
    <>
      <PageHeader title={t.title} />
      <ContentTabs current="/admin/contenido/legales" />
      <p className="small muted">{t.legalNote}</p>
      {!isAdmin && <p className="alert alert-info small">{t.onlyAdminsLegal}</p>}
      {error && <p className="alert alert-error">{t.legalError}</p>}
      <div className="stack">
        {rows.map((s) => (
          <article key={s.code} className="card card-body stack">
            <h2 style={{ margin: 0 }}>{s.name} {s.enabled ? <span className="badge badge-success">{t.enabled}</span> : <span className="badge">{t.disabled}</span>}</h2>
            {isAdmin ? (
              <ActionForm action={saveLegalService} submit={t.save}>
                <input type="hidden" name="code" value={s.code} />
                <div className="form-grid">
                  <div className="field"><label htmlFor={`n-${s.code}`} className="required">{t.name}</label><input id={`n-${s.code}`} name="name" className="input" required maxLength={120} defaultValue={s.name} /></div>
                  <div className="field"><label htmlFor={`r-${s.code}`}>{t.responsible}</label><input id={`r-${s.code}`} name="responsible_professional" className="input" maxLength={160} defaultValue={s.responsible_professional ?? ""} placeholder={t.responsiblePlaceholder} /></div>
                  <div className="field"><label htmlFor={`o-${s.code}`}>{t.order}</label><input id={`o-${s.code}`} name="sort_order" type="number" min={0} className="input" defaultValue={s.sort_order} /></div>
                </div>
                <div className="field"><label htmlFor={`d-${s.code}`}>{t.description}</label><textarea id={`d-${s.code}`} name="description" className="textarea" maxLength={1000} defaultValue={s.description ?? ""} /></div>
                <label className="check"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> {t.enabledCheck}</label>
              </ActionForm>
            ) : <p className="small">{s.description} {s.responsible_professional && `· ${t.responsibleLabel} ${s.responsible_professional}`}</p>}
          </article>
        ))}
      </div>
    </>
  );
}
