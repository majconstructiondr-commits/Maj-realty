"use client";
import Link from "next/link";
import { useActionState } from "react";
import { quickAction } from "@/app/panel/publicaciones/actions";
import { FormMessage } from "@/components/forms/FormBits";
import { idle, type ActionState } from "@/lib/action-state";
import type { ListingStatus } from "@/lib/catalog/definitions";
import { availableActions } from "@/lib/listing-editor/transitions";
import { usePrivateI18n } from "@/i18n/client";

export function QuickActions({ id, status, operation, canEdit, canDelete, canDuplicate, title }: {
  id: string;
  status: ListingStatus;
  operation: "venta" | "renta" | "ambas";
  canEdit: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  title: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(quickAction, idle);
  const t = usePrivateI18n().d.editor.quick;
  const actions = canEdit ? availableActions(status, operation).filter((a) => a !== "pausar") : [];
  const editable = canEdit && !["archivado", "vendido", "rentado"].includes(status);

  const btn = (op: string, label: string, primary?: boolean) => (
    <form action={action} key={op}>
      <input type="hidden" name="property_id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button
        type="submit"
        className={`btn btn-sm ${primary ? "btn-primary" : "btn-ghost"}`}
        disabled={pending}
        aria-label={`${label}: ${title}`}
        onClick={(e) => {
          const msg = t.confirm[op];
          if (msg && !confirm(msg)) e.preventDefault();
        }}
      >
        {label}
      </button>
    </form>
  );

  return (
    <div>
      <div className="le-quick">
        {editable ? (
          <Link className="btn btn-sm btn-outline" href={`/panel/publicaciones/${id}/editar`} aria-label={`${status === "borrador" || status === "rechazado" ? t.edit : t.requestChanges}: ${title}`}>
            {status === "borrador" || status === "rechazado" ? t.edit : t.requestChanges}
          </Link>
        ) : (
          <Link className="btn btn-sm btn-ghost" href={`/panel/publicaciones/${id}/editar?paso=8`}>{t.view}</Link>
        )}
        {actions.map((a) => (
          btn(a, t.actions[a], a === "enviar" || a === "reenviar")
        ))}
        {canDuplicate ? btn("duplicar", t.duplicate) : null}
        {canDelete ? btn("eliminar", t.deleteDraft) : null}
        {canEdit && status === "publicado" ? (
          <details>
            <summary className="btn btn-sm btn-ghost" style={{ display: "inline-flex" }}>{t.pause}</summary>
            <form action={action} className="row" style={{ marginTop: 8 }}>
              <input type="hidden" name="property_id" value={id} />
              <input type="hidden" name="op" value="pausar" />
              <label htmlFor={`pause-${id}`} className="sr-only">{t.pauseReason}</label>
              <input id={`pause-${id}`} name="reason" className="input" maxLength={300} placeholder={t.pauseReasonPlaceholder} style={{ maxWidth: 320 }} />
              <button type="submit" className="btn btn-sm btn-outline" disabled={pending}>{t.pauseSubmit}</button>
            </form>
          </details>
        ) : null}
      </div>
      <div aria-live="polite" style={{ marginTop: state.status === "idle" ? 0 : 8 }}>
        <FormMessage state={state} />
      </div>
    </div>
  );
}
