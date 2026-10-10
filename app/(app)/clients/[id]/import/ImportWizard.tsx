"use client";

import { useRef, useState } from "react";

interface DetectedField {
  field: string;
  label: string;
  required: boolean;
  column: number | null;
  header: string | null;
  confidence: "high" | "medium" | "low" | "none";
  sample: string;
}

interface SkippedRow {
  row: number;
  field: string;
  reason: string;
}

interface ImportResult {
  imported: number;
  skipped: SkippedRow[];
}

interface FileJob {
  name: string;
  csv: string;
  headers: string[];
  detected: DetectedField[];
  mapping: Record<string, number | null>;
  rowCount: number;
  channelFallback: string;
  result: ImportResult | null;
  error: string;
}

async function postImport(
  clientId: number,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data: Record<string, unknown>; error: string }> {
  try {
    const res = await fetch(`/api/clients/${clientId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data, error: (data.error as string) || "Request failed." };
  } catch {
    return { ok: false, data: {}, error: "Network error. Please try again." };
  }
}

export default function ImportWizard({ clientId }: { clientId: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [phase, setPhase] = useState<"pick" | "reading" | "confirm" | "done">("pick");
  const [progress, setProgress] = useState("");
  const [globalError, setGlobalError] = useState("");

  function reset() {
    setJobs([]);
    setPhase("pick");
    setProgress("");
    setGlobalError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setGlobalError("");
    setPhase("reading");
    const newJobs: FileJob[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`Reading file ${i + 1} of ${files.length}…`);
      const text = await f.text();
      setProgress(`Detecting columns in file ${i + 1} of ${files.length}…`);
      const { ok, data, error } = await postImport(clientId, {
        step: "detect",
        csv: text,
      });
      if (!ok) {
        newJobs.push({
          name: f.name,
          csv: text,
          headers: [],
          detected: [],
          mapping: {},
          rowCount: 0,
          channelFallback: "",
          result: null,
          error,
        });
        continue;
      }
      const detected = (data.detected as DetectedField[]) ?? [];
      const mapping: Record<string, number | null> = {};
      for (const d of detected) mapping[d.field] = d.column;
      newJobs.push({
        name: f.name,
        csv: text,
        headers: (data.headers as string[]) ?? [],
        detected,
        mapping,
        rowCount: (data.rowCount as number) ?? 0,
        channelFallback: "",
        result: null,
        error: "",
      });
    }
    setJobs(newJobs);
    setProgress("");
    setPhase("confirm");
  }

  function setMapping(idx: number, field: string, value: number | null) {
    setJobs((js) =>
      js.map((j, i) =>
        i === idx ? { ...j, mapping: { ...j.mapping, [field]: value } } : j
      )
    );
  }

  function setChannelFallback(idx: number, value: string) {
    setJobs((js) =>
      js.map((j, i) => (i === idx ? { ...j, channelFallback: value } : j))
    );
  }

  async function onCommit(idx: number) {
    const job = jobs[idx];
    if (!job || job.result) return;
    setJobs((js) =>
      js.map((j, i) => (i === idx ? { ...j, error: "" } : j))
    );
    setProgress(`Importing file ${idx + 1} of ${jobs.length}…`);
    const { ok, data, error } = await postImport(clientId, {
      step: "commit",
      csv: job.csv,
      mapping: job.mapping,
      channelFallback: job.channelFallback || undefined,
    });
    setProgress("");
    setJobs((js) =>
      js.map((j, i) =>
        i === idx
          ? {
              ...j,
              result: ok
                ? {
                    imported: (data.imported as number) ?? 0,
                    skipped: (data.skipped as SkippedRow[]) ?? [],
                  }
                : null,
              error: ok ? "" : error,
            }
          : j
      )
    );
    if (ok && jobs.every((j, i) => i === idx || j.result || j.error)) {
      setPhase("done");
    }
  }

  const totalImported = jobs.reduce((n, j) => n + (j.result?.imported ?? 0), 0);
  const totalSkipped = jobs.reduce((n, j) => n + (j.result?.skipped.length ?? 0), 0);

  return (
    <div>
      {globalError && <div className="alert alert-error">{globalError}</div>}

      {phase === "pick" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,text/csv"
            onChange={onFiles}
            className="input"
            style={{ maxWidth: 420 }}
          />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Select one or more CSV files. Each file is detected and imported
            separately.
          </p>
        </div>
      )}

      {phase === "reading" && (
        <p style={{ color: "var(--muted)" }}>{progress || "Reading files…"}</p>
      )}

      {(phase === "confirm" || phase === "done") && jobs.length > 0 && (
        <div>
          {progress && (
            <p style={{ color: "var(--muted)" }}>{progress}</p>
          )}

          {jobs.map((job, idx) => (
            <div
              key={idx}
              className="card"
              style={{ marginBottom: 16, padding: 16 }}
            >
              <h4 style={{ marginTop: 0 }}>
                File {idx + 1} of {jobs.length}: {job.name}
              </h4>

              {job.error && <div className="alert alert-error">{job.error}</div>}

              {job.result ? (
                <div className="alert alert-ok">
                  Imported <strong>{job.result.imported}</strong> rows.
                  {job.result.skipped.length > 0 &&
                    ` Skipped ${job.result.skipped.length} invalid rows.`}
                </div>
              ) : (
                job.detected.length > 0 && (
                  <div>
                    <p style={{ fontSize: 13 }}>
                      {job.rowCount} data rows detected. Confirm the column
                      mapping below, then import.
                    </p>
                    <div className="form-group" style={{ maxWidth: 420 }}>
                      <label className="field">
                        Channel tag fallback
                      </label>
                      <input
                        className="input"
                        value={job.channelFallback}
                        onChange={(e) => setChannelFallback(idx, e.target.value)}
                        placeholder="e.g. Google Ads"
                        maxLength={80}
                      />
                      <p style={{ color: "var(--muted)", fontSize: 12 }}>
                        Used when this file has no channel column.
                      </p>
                    </div>
                    <div className="mapgrid head">
                      <span>Metric</span>
                      <span>CSV column</span>
                      <span>Detection</span>
                      <span>Sample value</span>
                    </div>
                    {job.detected.map((d) => (
                      <div className="mapgrid" key={d.field}>
                        <span>
                          <strong>{d.label}</strong>
                          {d.required && (
                            <span style={{ color: "var(--red)" }}> *</span>
                          )}
                        </span>
                        <select
                          className="input"
                          style={{ padding: "6px 8px", fontSize: 13 }}
                          value={
                            job.mapping[d.field] === null ||
                            job.mapping[d.field] === undefined
                              ? ""
                              : String(job.mapping[d.field])
                          }
                          onChange={(e) =>
                            setMapping(
                              idx,
                              d.field,
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                        >
                          <option value="">— ignore —</option>
                          {job.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `(column ${i + 1})`}
                            </option>
                          ))}
                        </select>
                        <span>
                          {d.confidence === "none" ? (
                            <span className="conf none">not found</span>
                          ) : (
                            <span className={`conf ${d.confidence}`}>
                              {d.confidence}
                            </span>
                          )}
                        </span>
                        <span className="sample">{d.sample || "—"}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => onCommit(idx)}
                      >
                        Import {job.rowCount} rows
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          ))}

          {phase === "done" && (
            <div>
              <div className="alert alert-ok">
                All files processed: <strong>{totalImported}</strong> rows
                imported
                {totalSkipped > 0 && `, ${totalSkipped} rows skipped`}.
              </div>
              {totalSkipped > 0 && (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Row</th>
                        <th>Field</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.flatMap((j, idx) =>
                        (j.result?.skipped ?? [])
                          .slice(0, 50)
                          .map((s, i) => (
                            <tr key={`${idx}-${i}`}>
                              <td>{j.name}</td>
                              <td>{s.row}</td>
                              <td>{s.field}</td>
                              <td>{s.reason}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={reset}>
                  Import more files
                </button>
                <a className="btn" href={`/clients/${clientId}`}>
                  View dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
