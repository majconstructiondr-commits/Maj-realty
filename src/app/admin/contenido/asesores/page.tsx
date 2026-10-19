import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/Bits";
import { ContentTabs } from "@/components/admin/ContentTabs";
import { UploadForm } from "@/components/admin/UploadForm";
import { labelFor, staffCtx, userLabels } from "@/lib/admin/server";
import { createAdvisor, setAdvisorPhoto, updateAdvisor } from "../actions";
import { getI18n } from "@/i18n/server";

type Adv = { id: string; user_id: string | null; display_name: string; title: string | null; whatsapp: string | null; photo_path: string | null; bio: string | null; show_on_team_page: boolean; is_active: boolean; sort_order: number };

export default async function AdminAdvisors() {
  const { supabase, isAdmin } = await staffCtx("/admin/contenido/asesores");
  const t = (await getI18n()).d.admin.content;
  const { data, error } = await supabase.from("advisors").select("*").order("sort_order");
  const rows = (data ?? []) as Adv[];
  const people = await userLabels(supabase, rows.map((r) => r.user_id));
  const url = (p: string | null) => (p ? supabase.storage.from("public-assets").getPublicUrl(p).data.publicUrl : null);
  return (
    <>
      <PageHeader title={t.title} />
      <ContentTabs current="/admin/contenido/asesores" />
      <p className="small muted">{t.advisorsNote}</p>
      {!isAdmin && <p className="alert alert-info small">{t.onlyAdminsAdvisors}</p>}
      {isAdmin && (
        <details className="card card-body" style={{ marginBottom: 16 }}>
          <summary><strong>{t.newAdvisor}</strong></summary>
          <ActionForm action={createAdvisor} submit={t.createAdvisor} resetOnSuccess><Fields /></ActionForm>
        </details>
      )}
      {error && <p className="alert alert-error">{t.advisorsError}</p>}
      <div className="stack">
        {rows.map((a) => (
          <article key={a.id} className="card card-body stack">
            <div className="row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {url(a.photo_path) ? <img src={url(a.photo_path)!} alt={a.display_name} width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} /> : null}
              <h2 style={{ margin: 0 }}>{a.display_name}</h2>
              {a.is_active ? <span className="badge badge-success">{t.active}</span> : <span className="badge">{t.inactive}</span>}
              {a.show_on_team_page && <span className="badge badge-gold">{t.onTeamPage}</span>}
            </div>
            <p className="small">{a.title} {a.whatsapp && `· WhatsApp ${a.whatsapp}`} {a.user_id && `· ${t.accountLabel} ${labelFor(people, a.user_id)}`}</p>
            {isAdmin && (
              <>
                <UploadForm action={setAdvisorPhoto} bucket="public-assets" prefix={`team/${a.id}`} kind="image" submit={t.uploadPhoto} fileLabel={t.photoLabel}>
                  <input type="hidden" name="id" value={a.id} />
                </UploadForm>
                <ActionForm action={updateAdvisor} submit={t.save}>
                  <input type="hidden" name="id" value={a.id} />
                  <Fields a={a} />
                  {a.user_id && <label className="check"><input type="checkbox" name="unlink_user" /> {t.unlink} ({people.get(a.user_id)?.email})</label>}
                </ActionForm>
              </>
            )}
          </article>
        ))}
        {rows.length === 0 && <p className="empty card">{t.noAdvisors}</p>}
      </div>
    </>
  );
}

async function Fields({ a }: { a?: Adv }) {
  const t = (await getI18n()).d.admin.content;
  const k = a?.id ?? "new";
  return (
    <>
      <div className="form-grid">
        <div className="field"><label htmlFor={`n-${k}`} className="required">{t.name}</label><input id={`n-${k}`} name="display_name" className="input" required minLength={2} maxLength={80} defaultValue={a?.display_name ?? ""} /></div>
        <div className="field"><label htmlFor={`t-${k}`}>{t.jobTitle}</label><input id={`t-${k}`} name="title" className="input" maxLength={80} defaultValue={a?.title ?? ""} /></div>
        <div className="field"><label htmlFor={`w-${k}`}>WhatsApp</label><input id={`w-${k}`} name="whatsapp" className="input" inputMode="numeric" maxLength={20} defaultValue={a?.whatsapp ?? ""} placeholder="18095551234" /><span className="hint">{t.digitsHint}</span></div>
        <div className="field"><label htmlFor={`e-${k}`}>{t.linkAccount}</label><input id={`e-${k}`} name="user_email" type="email" className="input" maxLength={160} /><span className="hint">{t.linkHint}</span></div>
        <div className="field"><label htmlFor={`o-${k}`}>{t.order}</label><input id={`o-${k}`} name="sort_order" type="number" min={0} className="input" defaultValue={a?.sort_order ?? 0} /></div>
      </div>
      <div className="field"><label htmlFor={`b-${k}`}>{t.bio}</label><textarea id={`b-${k}`} name="bio" className="textarea" maxLength={600} defaultValue={a?.bio ?? ""} /></div>
      <label className="check"><input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} /> {t.active}</label>
      <label className="check"><input type="checkbox" name="show_on_team_page" defaultChecked={a?.show_on_team_page ?? false} /> {t.showOnTeam}</label>
    </>
  );
}
