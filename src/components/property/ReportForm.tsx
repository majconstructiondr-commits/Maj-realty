"use client";
import { useActionState, useEffect, useState } from "react";
import { reportListing, type ReportState } from "@/app/actions/listing";
import { useI18n } from "@/i18n/client";

export function ReportForm({ propertyId }: { propertyId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportListing, { status: "idle" });
  const [t0, setT0] = useState(0);
  const { d } = useI18n();
  const r = d.report;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca de tiempo solo en el cliente
    setT0(Date.now());
  }, []);
  if (state.status === "ok") return <p className="alert alert-success" role="status">{state.message}</p>;
  return (
    <details>
      <summary className="small" style={{ cursor: "pointer" }}>{r.summary}</summary>
      <form action={action} className="form" style={{ marginTop: 10 }}>
        <input type="hidden" name="property_id" value={propertyId} />
        <input type="hidden" name="_t" value={t0 || ""} />
        <div className="honeypot" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor="rep-reason">{r.reason}</label>
          <select id="rep-reason" name="reason" className="select" required defaultValue="">
            <option value="" disabled>{d.common.select}</option>
            {Object.entries(r.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-details">{r.details}</label>
          <textarea id="rep-details" name="details" className="textarea" maxLength={2000} />
        </div>
        <div className="field">
          <label htmlFor="rep-email">{r.email}</label>
          <input id="rep-email" name="contact_email" type="email" className="input" maxLength={160} />
        </div>
        {state.status === "error" ? <p className="alert alert-error" role="alert">{state.message}</p> : null}
        <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? d.common.sending : r.send}</button>
      </form>
    </details>
  );
}
