import { ActionForm } from "@/components/admin/ActionForm";
import { clearIdentityReview, setIdentityReview } from "@/app/admin/usuarios/actions";
import { localDay } from "@/lib/admin/time";
import { formatDate } from "@/lib/format";

/** Registro de revisión de identidad (solo con verificación real; indicar el alcance). */
export function IdentityReview({ userId, reviewedAt, scope, back }: { userId: string; reviewedAt: string | null; scope: string | null; back: string }) {
  return (
    <div className="stack">
      <p className="small">
        {reviewedAt ? <>Identidad revisada el {formatDate(reviewedAt)}: <strong>{scope}</strong></> : "Identidad no revisada por MAJ."}
      </p>
      <ActionForm action={setIdentityReview} submit="Registrar revisión de identidad" buttonClass="btn btn-ghost btn-sm" confirm="Confirme que revisó realmente los documentos indicados.">
        <input type="hidden" name="user_id" value={userId} />
        <input type="hidden" name="back" value={back} />
        <div className="form-grid">
          <div className="field"><label htmlFor={`ir-d-${userId}`} className="required">Fecha</label><input id={`ir-d-${userId}`} type="date" name="reviewed_on" className="input" required defaultValue={localDay(new Date())} /></div>
          <div className="field"><label htmlFor={`ir-s-${userId}`} className="required">Alcance</label><input id={`ir-s-${userId}`} name="scope" className="input" required minLength={10} maxLength={300} defaultValue={scope ?? ""} placeholder="Cédula original comparada con selfie y datos del perfil" /></div>
        </div>
      </ActionForm>
      {reviewedAt && (
        <ActionForm action={clearIdentityReview} submit="Retirar marca" buttonClass="btn btn-ghost btn-sm" confirm="¿Retirar la marca de revisión de identidad?">
          <input type="hidden" name="user_id" value={userId} />
        </ActionForm>
      )}
    </div>
  );
}
