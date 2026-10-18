"use client";
import { useI18n } from "@/i18n/client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const { d } = useI18n();
  const t = d.errorPage;
  return (
    <div className="container section center" role="alert">
      <h1>{t.title}</h1>
      <p className="muted">{t.text}</p>
      <button className="btn btn-primary" onClick={reset}>{t.retry}</button>
    </div>
  );
}
