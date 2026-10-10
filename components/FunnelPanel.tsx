"use client";

import { useEffect, useState } from "react";
import { fmtMoney, fmtNum, fmtPct } from "../lib/format";

interface FunnelStage {
  stage: string;
  value: number;
  rateFromPrev: number | null;
}

interface FunnelChannel {
  channel: string;
  spend: number;
  conversions: number;
  spendShare: number;
  conversionShare: number;
}

export default function FunnelPanel({
  clientId,
  from,
  to,
}: {
  clientId: number;
  from: string;
  to: string;
}) {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [channels, setChannels] = useState<FunnelChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetch(
      `/api/clients/${clientId}/funnel?from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}`
    )
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok) {
          setError(d.error || "Could not load the funnel.");
        } else {
          setStages(d.stages ?? []);
          setChannels(d.channels ?? []);
        }
      })
      .catch(() => alive && setError("Network error. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [clientId, from, to]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading funnel…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (stages.length === 0)
    return <p style={{ color: "var(--muted)" }}>No data in this period.</p>;

  const max = Math.max(...stages.map((s) => s.value), 1);
  const valueOf = (s: FunnelStage) =>
    s.stage === "Revenue" ? fmtMoney(s.value) : fmtNum(s.value);

  return (
    <div>
      <div className="spacer" />
      {stages.map((s) => (
        <div key={s.stage} style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>{s.stage}</span>
            <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              {s.rateFromPrev !== null && (
                <span
                  className="badge"
                  title="Stage-to-stage conversion rate"
                >
                  {fmtPct(s.rateFromPrev)} from previous
                </span>
              )}
              <strong className="num">{valueOf(s)}</strong>
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: "var(--border)",
              marginTop: 6,
            }}
          >
            <div
              style={{
                width: `${Math.max(2, (s.value / max) * 100)}%`,
                height: "100%",
                borderRadius: 5,
                background: "var(--accent, #3b82f6)",
              }}
            />
          </div>
        </div>
      ))}

      {channels.length > 0 && (
        <>
          <h4 style={{ marginTop: 24 }}>Channel contribution</h4>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Spend</th>
                  <th className="num">Spend share</th>
                  <th className="num">Conversions</th>
                  <th className="num">Conversion share</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.channel}>
                    <td>{c.channel}</td>
                    <td className="num">{fmtMoney(c.spend)}</td>
                    <td className="num">{fmtPct(c.spendShare)}</td>
                    <td className="num">{fmtNum(c.conversions)}</td>
                    <td className="num">{fmtPct(c.conversionShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
