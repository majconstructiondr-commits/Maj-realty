"use client";
import { useState } from "react";
import Link from "next/link";
import { OPERATIONS, PROPERTY_TYPES } from "@/lib/catalog/definitions";
import { parseCsv, parseImportSheet, type ParsedImportRow } from "@/lib/import/listings";
import { importListingRow, type ImportResult } from "./actions";

type Outcome = ImportResult | { status: "pending" } | { status: "running" };

async function readFile(file: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(await file.text());
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as unknown[][];
}

export function ImportForm() {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [running, setRunning] = useState(false);

  const valid = rows.filter((r) => r.data);
  const done = Object.values(outcomes).filter((o) => o.status !== "pending" && o.status !== "running").length;
  const remaining = valid.filter((r) => !["ok", "duplicate"].includes(outcomes[r.line]?.status ?? "")).length;

  async function onFile(file: File | undefined) {
    setRows([]); setOutcomes({}); setFileError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setFileError("El archivo pesa más de 5 MB."); return; }
    try {
      const parsed = parseImportSheet(await readFile(file));
      setRows(parsed.rows);
      if (parsed.error) setFileError(parsed.error);
    } catch {
      setFileError("No se pudo leer el archivo. Use .xlsx o .csv.");
    }
  }

  async function run() {
    if (!source.trim() || !authorized || running) return;
    setRunning(true);
    // Al reintentar, solo se procesan las filas que aún no se crearon.
    const todo = valid.filter((r) => !["ok", "duplicate"].includes(outcomes[r.line]?.status ?? ""));
    setOutcomes((o) => {
      const next = { ...o };
      for (const r of todo) next[r.line] = { status: "pending" };
      return next;
    });
    for (const r of todo) {
      setOutcomes((o) => ({ ...o, [r.line]: { status: "running" } }));
      let res: ImportResult;
      try {
        res = await importListingRow({ row: r.data!, source, authorized });
      } catch {
        res = { status: "error", message: "Error de conexión. Vuelva a intentar: las filas ya importadas no se duplican si tienen referencia." };
      }
      setOutcomes((o) => ({ ...o, [r.line]: res }));
    }
    setRunning(false);
  }

  const summary = (() => {
    const list = Object.values(outcomes);
    return {
      ok: list.filter((o) => o.status === "ok").length,
      dup: list.filter((o) => o.status === "duplicate").length,
      err: list.filter((o) => o.status === "error").length,
    };
  })();

  return (
    <div className="card card-body stack">
      <h2 style={{ margin: 0 }}>Subir archivo</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="imp-file" className="required">Archivo de Excel o CSV</label>
          <input id="imp-file" type="file" className="input" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={running} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div className="field">
          <label htmlFor="imp-source" className="required">Empresa de origen</label>
          <input id="imp-source" className="input" maxLength={120} value={source} disabled={running} onChange={(e) => setSource(e.target.value)} placeholder="Nombre de la empresa" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={authorized} disabled={running} onChange={(e) => setAuthorized(e.target.checked)} />
        <span>Tengo autorización escrita de esta empresa para publicar estos inmuebles y sus fotos.</span>
      </label>
      {fileError ? <p className="alert alert-error" role="alert">{fileError}</p> : null}

      {rows.length ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            {rows.length} fila(s) en el archivo: <strong>{valid.length} listas</strong>
            {rows.length - valid.length ? <>, <strong>{rows.length - valid.length} con errores</strong> (no se importan; corríjalas en el Excel y súbalo de nuevo)</> : null}.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fila</th><th>Título</th><th>Tipo</th><th>Fotos</th><th>Resultado</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const o = outcomes[r.line];
                  return (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>{r.title}{r.data?.referencia ? <div className="small muted">Ref. {r.data.referencia}</div> : null}</td>
                      <td className="small">{r.data ? `${PROPERTY_TYPES[r.data.tipo]} · ${OPERATIONS[r.data.operacion]}` : "—"}</td>
                      <td>{r.data ? r.data.fotos.length : "—"}</td>
                      <td className="small">
                        {r.errors.length ? <ul className="error" style={{ margin: 0, paddingLeft: 16 }}>{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                          : !o ? "Lista"
                          : o.status === "pending" ? "En cola"
                          : o.status === "running" ? "Importando…"
                          : o.status === "duplicate" ? <>Ya existía: <Link href={`/admin/inmuebles/${o.id}`}>{o.code}</Link></>
                          : o.status === "error" ? <span className="error">{o.message}</span>
                          : <>
                              Creado <Link href={`/admin/inmuebles/${o.id}`}>{o.code}</Link> · {o.photos} foto(s)
                              {o.photoErrors.length ? <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{o.photoErrors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
                            </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {running || done ? (
            <p className="small" role="status" aria-live="polite" style={{ margin: 0 }}>
              {running ? `Importando… ${done} listos. No cierre esta página.` : `Terminado: ${summary.ok} creados, ${summary.dup} ya existían, ${summary.err} con error.`}
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!remaining || !source.trim() || !authorized || running} onClick={run}>
              {running ? "Importando…" : done ? `Reintentar ${remaining} con error` : `Importar ${valid.length} inmueble(s) como borrador`}
            </button>
            {!running && done ? <Link className="btn btn-ghost" href="/admin/inmuebles?status=borrador&maj=1">Ver borradores</Link> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
