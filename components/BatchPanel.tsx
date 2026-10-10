"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate } from "../lib/format";

type Preset = "30" | "90" | "180" | "all";

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "180", label: "Last 180 days" },
  { key: "all", label: "All time" },
];

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The selected period flows straight into the API — nothing is hard-coded.
 * "All time" spans minDate → maxDate; the others end at maxDate.
 */
function periodFor(
  preset: Preset,
  minDate: string,
  maxDate: string
): { from: string; to: string } {
  if (preset === "all") return { from: minDate, to: maxDate };
  const days = Number(preset);
  return { from: shiftDays(maxDate, -(days - 1)), to: maxDate };
}

interface Result {
  clientId: number;
  clientName: string;
  reportId?: number;
  error?: string;
}

export default function BatchPanel({
  clients,
  minDate,
  maxDate,
}: {
  clients: Array<{ id: number; name: string }>;
  minDate: string;
  maxDate: string;
}) {
  const [preset, setPreset] = useState<Preset>("30");
  const [selected, setSelected] = useState<number[]>(() => clients.map((c) => c.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);

  const period = useMemo(() => periodFor(preset, minDate, maxDate), [preset, minDate, maxDate]);
  const nameOf = (id: number) => clients.find((c) => c.id === id)?.name ?? `#${id}`;

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function generate() {
    if (selected.length === 0 || busy) return;
    setError("");
    setBusy(true);
    // Mark every selected client pending up front.
    setResults(selected.map((id) => ({ clientId: id, clientName: nameOf(id) })));
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds: selected,
          from: period.from,
          to: period.to,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: Array<{ clientId: number; reportId?: number; error?: string }>;
      };
      if (!res.ok) {
        setResults(
          selected.map((id) => ({
            clientId: id,
            clientName: nameOf(id),
            error: data.error || "Generation failed.",
          }))
        );
      } else {
        setResults(
          (data.results ?? []).map((r) => ({
            clientId: r.clientId,
            clientName: nameOf(r.clientId),
            reportId: r.reportId,
            error: r.error,
          }))
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const doneCount = results?.filter((r) => r.reportId).length ?? 0;

  return (
    <div className="card">
      <h3>Batch report generation</h3>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`btn btn-sm${preset === p.key ? " btn-primary" : ""}`}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        <span className="sub">
          Period: {fmtDate(period.from)} – {fmtDate(period.to)}
        </span>
      </div>

      {clients.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No clients to generate reports for.</p>
      ) : (
        <>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelected(clients.map((c) => c.id))}
            >
              Select all
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSelected([])}>
              Clear
            </button>
            <span className="sub">{selected.length} selected</span>
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {clients.map((c) => (
              <label
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || selected.length === 0}
        onClick={generate}
      >
        {busy ? "Generating…" : `Generate for ${selected.length} client${selected.length === 1 ? "" : "s"}`}
      </button>

      {results && (
        <div style={{ marginTop: 16 }}>
          <div className="toolbar" style={{ marginBottom: 8 }}>
            <strong>
              {busy
                ? `Generating… (${doneCount}/${results.length} done)`
                : `${doneCount}/${results.length} reports generated`}
            </strong>
            <div className="spacer" />
            <Link href="/reports" className="btn btn-sm">
              Open report library
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {results.map((r) => (
                  <tr key={r.clientId}>
                    <td>{r.clientName}</td>
                    <td className="num">
                      {r.reportId ? (
                        <Link href={`/reports/${r.reportId}`} className="btn btn-sm">
                          Open report
                        </Link>
                      ) : r.error ? (
                        <span style={{ color: "#b91c1c", fontSize: 13 }}>{r.error}</span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>
                          Generating…
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
