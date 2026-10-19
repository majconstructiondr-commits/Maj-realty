"use client";
import { useState } from "react";
import Link from "next/link";
import { parseCsv, parseImportSheet, type ParsedImportRow } from "@/lib/import/listings";
import { importListingRow, type ImportResult } from "./actions";
import { fmt } from "@/i18n/fmt";
import { usePrivateI18n } from "@/i18n/client";
import { importMsgEs, localizeImportMessage } from "@/i18n/sections/import-msg";

type Outcome = ImportResult | { status: "pending" } | { status: "running" };

async function readFile(file: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") return parseCsv(await file.text());
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as unknown[][];
}

export function ImportForm() {
  const { d } = usePrivateI18n();
  const t = d.admin.importUi;
  // La validación de filas corre en el navegador con mensajes en español: se traducen al mostrarlos.
  const tr = (m: string) => localizeImportMessage(m, d.admin.importer);
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
    if (file.size > 5 * 1024 * 1024) { setFileError(importMsgEs.msg.fileTooLarge); return; }
    try {
      const parsed = parseImportSheet(await readFile(file));
      setRows(parsed.rows);
      if (parsed.error) setFileError(parsed.error);
    } catch {
      setFileError(importMsgEs.msg.unreadable);
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
        res = { status: "error", message: tr(importMsgEs.msg.connection) };
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
      <h2 style={{ margin: 0 }}>{t.upload}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="imp-file" className="required">{t.file}</label>
          <input id="imp-file" type="file" className="input" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={running} onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div className="field">
          <label htmlFor="imp-source" className="required">{t.source}</label>
          <input id="imp-source" className="input" maxLength={120} value={source} disabled={running} onChange={(e) => setSource(e.target.value)} placeholder={t.sourcePlaceholder} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={authorized} disabled={running} onChange={(e) => setAuthorized(e.target.checked)} />
        <span>{t.authorized}</span>
      </label>
      {fileError ? <p className="alert alert-error" role="alert">{tr(fileError)}</p> : null}

      {rows.length ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            {fmt(t.rowsInFile, { n: rows.length })} <strong>{fmt(t.ready, { n: valid.length })}</strong>
            {rows.length - valid.length ? <>, <strong>{fmt(t.withErrors, { n: rows.length - valid.length })}</strong> {t.withErrorsNote}</> : null}.
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t.row}</th><th>{t.titleCol}</th><th>{t.typeCol}</th><th>{t.photosCol}</th><th>{t.resultCol}</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const o = outcomes[r.line];
                  return (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>{tr(r.title)}{r.data?.referencia ? <div className="small muted">{fmt(t.ref, { ref: r.data.referencia })}</div> : null}</td>
                      <td className="small">{r.data ? `${d.labels.propertyTypes[r.data.tipo]} · ${d.labels.operations[r.data.operacion]}` : "—"}</td>
                      <td>{r.data ? r.data.fotos.length : "—"}</td>
                      <td className="small">
                        {r.errors.length ? <ul className="error" style={{ margin: 0, paddingLeft: 16 }}>{r.errors.map((e) => <li key={e}>{tr(e)}</li>)}</ul>
                          : !o ? t.rowReady
                          : o.status === "pending" ? t.queued
                          : o.status === "running" ? t.importing
                          : o.status === "duplicate" ? <>{t.existed} <Link href={`/admin/inmuebles/${o.id}`}>{o.code}</Link></>
                          : o.status === "error" ? <span className="error">{o.message}</span>
                          : <>
                              {t.created} <Link href={`/admin/inmuebles/${o.id}`}>{o.code}</Link> · {fmt(t.photos, { n: o.photos })}
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
              {running ? fmt(t.progress, { n: done }) : fmt(t.finished, { ok: summary.ok, dup: summary.dup, err: summary.err })}
            </p>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!remaining || !source.trim() || !authorized || running} onClick={run}>
              {running ? t.importing : done ? fmt(t.retry, { n: remaining }) : fmt(t.importN, { n: valid.length })}
            </button>
            {!running && done ? <Link className="btn btn-ghost" href="/admin/inmuebles?status=borrador&maj=1">{t.viewDrafts}</Link> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
