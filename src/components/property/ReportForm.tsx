"use client";
import { useActionState, useEffect, useState } from "react";
import { reportListing, type ReportState } from "@/app/actions/listing";

export function ReportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportListing, { status: "idle" });
  const [t0, setT0] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca de tiempo solo en el cliente
    setT0(Date.now());
  }, []);
  if (state.status === "ok") return <p className="alert alert-success" role="status">{state.message}</p>;
  return (
    <details>
      <summary className="small" style={{ cursor: "pointer" }}>Reportar esta publicación</summary>
      <form action={action} className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="_t" value={t0 || ""} />
        <div className="honeypot" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor="rep-reason">Motivo</label>
          <select id="rep-reason" name="reason" className="select" required defaultValue="">
            <option value="" disabled>Seleccione…</option>
            <option value="informacion_falsa">Información falsa o engañosa</option>
            <option value="no_disponible">Ya no está disponible</option>
            <option value="precio_incorrecto">Precio incorrecto</option>
            <option value="fraude">Posible fraude</option>
            <option value="contenido_inapropiado">Contenido inapropiado</option>
            <option value="duplicado">Publicación duplicada</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-details">Detalles (opcional)</label>
          <textarea id="rep-details" name="details" className="textarea" maxLength={2000} />
        </div>
        <div className="field">
          <label htmlFor="rep-email">Correo para respuesta (opcional)</label>
          <input id="rep-email" name="contact_email" type="email" className="input" maxLength={160} />
        </div>
        {state.status === "error" ? <p className="alert alert-error" role="alert">{state.message}</p> : null}
        <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "Enviando…" : "Enviar reporte"}</button>
      </form>
    </details>
  );
}
