"use client";

import { useEffect, useState } from "react";
import { fmtMoney, fmtPct } from "../lib/format";

interface Pacing {
  month: string;
  budget: number;
  spend: number;
  dayOfMonth: number;
  daysInMonth: number;
  expected: number;
  ratio: number;
  status: "on-track" | "over" | "under" | "no-budget";
}

const STATUS_COPY: Record<Pacing["status"], { label: string; text: string }> = {
  "on-track": {
    label: "On track",
    text: "Spend is pacing in line with the pro-rata budget.",
  },
  over: {
    label: "Over pacing",
    text: "Spend is running ahead of the pro-rata budget — expect to overspend by month end.",
  },
  under: {
    label: "Under pacing",
    text: "Spend is running behind the pro-rata budget — there is room left to invest.",
  },
  "no-budget": {
    label: "No budget set",
    text: "Set a budget for this month to enable pacing.",
  },
};

export default function PacingPanel({ clientId }: { clientId: number }) {
  const [pacing, setPacing] = useState<Pacing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/clients/${clientId}/pacing`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok) setError(d.error || "Could not load pacing.");
        else setPacing(d.pacing ?? null);
      })
      .catch(() => alive && setError("Network error. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [clientId]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading pacing…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!pacing) return <p style={{ color: "var(--muted)" }}>No pacing data.</p>;

  const status = STATUS_COPY[pacing.status];
  const barPct =
    pacing.expected > 0 ? Math.min(100, (pacing.spend / pacing.expected) * 100) : 0;
  const [y, m] = pacing.month.split("-");
  const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h4 style={{ margin: 0 }}>{monthLabel}</h4>
        <span className="badge">{status.label}</span>
      </div>
      <div className="spacer" />

      <div className="grid" style={{ marginBottom: 16 }}>
        <div>
          <div className="sub">Budget</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {pacing.status === "no-budget" ? "—" : fmtMoney(pacing.budget)}
          </div>
        </div>
        <div>
          <div className="sub">Spent so far</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {fmtMoney(pacing.spend)}
          </div>
        </div>
        <div>
          <div className="sub">Expected by day {pacing.dayOfMonth}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {pacing.status === "no-budget" ? "—" : fmtMoney(pacing.expected)}
          </div>
        </div>
      </div>

      {pacing.status !== "no-budget" && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--muted)" }}>
              Actual spend vs. expected (pro-rata)
            </span>
            <span className="num">{fmtPct(pacing.ratio * 100)}</span>
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 6,
              background: "var(--border)",
            }}
          >
            <div
              style={{
                width: `${barPct}%`,
                height: "100%",
                borderRadius: 6,
                background:
                  pacing.status === "over"
                    ? "var(--red, #ef4444)"
                    : pacing.status === "under"
                      ? "var(--amber, #f59e0b)"
                      : "var(--green, #22c55e)",
              }}
            />
          </div>
        </div>
      )}

      <p style={{ color: "var(--muted)", fontSize: 13 }}>{status.text}</p>
    </div>
  );
}
