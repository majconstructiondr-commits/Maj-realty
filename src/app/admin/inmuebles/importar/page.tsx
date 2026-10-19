import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/Bits";
import { staffCtx } from "@/lib/admin/server";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, MAX_PHOTOS_PER_ROW } from "@/lib/import/listings";
import { ImportForm } from "./ImportForm";
import { fmt } from "@/i18n";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).d.admin.importUi.metaTitle, robots: { index: false } };
}
// Cada inmueble descarga sus fotos en el servidor.
export const maxDuration = 120;

export default async function ImportPage() {
  await staffCtx("/admin/inmuebles/importar");
  const t = (await getI18n()).d.admin.importUi;
  return (
    <>
      <PageHeader title={t.title} back={{ href: "/admin/inmuebles", label: t.back }} />
      <div className="stack">
        <div className="card card-body stack">
          <h2 style={{ margin: 0 }}>{t.how}</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{t.step1a} <a href="/plantillas/plantilla-inmuebles.xlsx" download>{t.step1Link}</a> {t.step1b}</li>
            <li>{t.step2}</li>
            <li>{t.step3a} <strong>{t.step3Strong}</strong>{t.step3b}</li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            {fmt(t.limits, { rows: MAX_IMPORT_ROWS, photos: MAX_PHOTOS_PER_ROW })}
          </p>
          <details className="small">
            <summary>{t.columnsTitle}</summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {IMPORT_COLUMNS.map(([c, h]) => {
                // Las columnas siguen en español (son los encabezados del Excel); la ayuda se traduce.
                const help = h ? (t.columns[c] ?? h) : "";
                return <li key={c}><code>{c}</code>{help ? ` · ${help.replace(/^\* /, `${t.required} · `)}` : ""}</li>;
              })}
            </ul>
          </details>
        </div>
        <ImportForm />
      </div>
    </>
  );
}
