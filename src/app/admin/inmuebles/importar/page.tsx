import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/Bits";
import { staffCtx } from "@/lib/admin/server";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, MAX_PHOTOS_PER_ROW } from "@/lib/import/listings";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Importar inmuebles", robots: { index: false } };
// Cada inmueble descarga sus fotos en el servidor.
export const maxDuration = 120;

export default async function ImportPage() {
  await staffCtx("/admin/inmuebles/importar");
  return (
    <>
      <PageHeader title="Importar inmuebles desde Excel" back={{ href: "/admin/inmuebles", label: "Inmuebles" }} />
      <div className="stack">
        <div className="card card-body stack">
          <h2 style={{ margin: 0 }}>Cómo funciona</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Descargue la <a href="/plantillas/plantilla-inmuebles.xlsx" download>plantilla de Excel</a> y pídale a la empresa que la llene (o use su propio Excel con los mismos encabezados).</li>
            <li>Suba el archivo (.xlsx o .csv). Verá cada fila revisada antes de importar.</li>
            <li>Cada inmueble se crea como <strong>borrador de MAJ</strong>, con sus fotos descargadas de los enlaces. Revíselo y publíquelo desde su ficha.</li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            Hasta {MAX_IMPORT_ROWS} inmuebles por archivo y {MAX_PHOTOS_PER_ROW} fotos por inmueble. Si una fila tiene «referencia», no se importa dos veces de la misma empresa.
          </p>
          <details className="small">
            <summary>Columnas de la plantilla</summary>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {IMPORT_COLUMNS.map(([c, h]) => <li key={c}><code>{c}</code>{h ? ` · ${h.replace(/^\* /, "obligatoria · ")}` : ""}</li>)}
            </ul>
          </details>
        </div>
        <ImportForm />
      </div>
    </>
  );
}
