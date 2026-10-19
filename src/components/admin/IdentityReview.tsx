import { ActionForm } from "@/components/admin/ActionForm";
import { clearIdentityReview, setIdentityReview } from "@/app/admin/usuarios/actions";
import { localDay } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

/** Registro de revisión de identidad (solo con verificación real; indicar el alcance). */
export async function IdentityReview({ userId, reviewedAt, scope, back }: { userId: string; reviewedAt: string | null; scope: string | null; back: string }) {
  const t = (await getI18n()).d.admin.identity;
  return (
    <div className="stack">
      <p className="small">
        {reviewedAt ? <>{fmt(t.reviewed, { date: formatDate(reviewedAt) })} <strong>{scope}</strong></> : t.notReviewed}
      </p>
      <ActionForm action={setIdentityReview} submit={t.register} buttonClass="btn btn-ghost btn-sm" confirm={t.confirm}>
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="back" value={back} />
        <div className="form-grid">
          <div className="field"><label htmlFor={`ir-d-${userId}`} className="required">{t.date}</label><input id={`ir-d-${userId}`} type="date" name="reviewed_on" className="input" required defaultValue={localDay(new Date())} /></div>
          <div className="field"><label htmlFor={`ir-s-${userId}`} className="required">{t.scope}</label><input id={`ir-s-${userId}`} name="scope" className="input" required minLength={10} maxLength={300} defaultValue={scope ?? ""} placeholder={t.scopePlaceholder} /></div>
        </div>
      </ActionForm>
      {reviewedAt && (
        <ActionForm action={clearIdentityReview} submit={t.clear} buttonClass="btn btn-ghost btn-sm" confirm={t.confirmClear}>
          <input type="hidden" name="user_id" value={userId} />
        </ActionForm>
      )}
    </div>
  );
}
