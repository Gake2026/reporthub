"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LineChart, BarList, type Series } from "../../../../components/charts";
import { Kpi, pctChange, PeriodLabel } from "../../../../components/ui";
import { fmtMoney, fmtMoney2, fmtNum, fmtPct } from "../../../../lib/format";
import type { PeriodData, Kpis } from "../../../../lib/metrics";

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "6M", days: 182 },
];

const METRICS = [
  { key: "spend", label: "Spend", color: "#4f46e5", format: fmtMoney },
  { key: "clicks", label: "Clicks", color: "#0ea5e9", format: fmtNum },
  { key: "conversions", label: "Conversions", color: "#16a34a", format: fmtNum },
  { key: "impressions", label: "Impressions", color: "#d97706", format: fmtNum },
  { key: "revenue", label: "Revenue", color: "#7c3aed", format: fmtMoney },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DashboardClient({
  clientId,
  from,
  to,
  data,
  contacts,
  notes,
  editable,
}: {
  clientId: number;
  from: string;
  to: string;
  data: PeriodData & { prev: Kpis };
  contacts: Array<{ id: number; name: string; email: string; role: string }>;
  notes: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState<MetricKey>("spend");
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const go = (f: string, t: string) => {
    router.push(`/clients/${clientId}?from=${f}&to=${t}`);
  };

  const today = new Date().toISOString().slice(0, 10);
  const activePreset = PRESETS.find(
    (p) => shiftDays(to, -(p.days - 1)) === from
  )?.label;

  const m = METRICS.find((x) => x.key === metric)!;
  const series: Series[] = [
    {
      name: m.label,
      color: m.color,
      points: data.trend.map((t) => ({ x: t.date, y: t[metric] })),
      format: m.format,
    },
  ];

  const { kpis, prev } = data;

  return (
    <>
      <div className="toolbar">
        <div className="rangebar">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={"preset" + (activePreset === p.label ? " on" : "")}
              onClick={() => go(shiftDays(today, -(p.days - 1)), today)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="input"
          style={{ width: "auto" }}
          value={customFrom}
          max={customTo}
          onChange={(e) => setCustomFrom(e.target.value)}
        />
        <input
          type="date"
          className="input"
          style={{ width: "auto" }}
          value={customTo}
          min={customFrom}
          max={today}
          onChange={(e) => setCustomTo(e.target.value)}
        />
        <button className="btn btn-sm" onClick={() => go(customFrom, customTo)}>
          Apply
        </button>
        <div className="spacer" />
        <PeriodLabel from={from} to={to} />
      </div>

      <div className="kpi-grid">
        <Kpi label="Spend" value={fmtMoney(kpis.spend)} delta={pctChange(kpis.spend, prev.spend)} positiveGood={false} />
        <Kpi label="Impressions" value={fmtNum(kpis.impressions)} delta={pctChange(kpis.impressions, prev.impressions)} />
        <Kpi label="Clicks" value={fmtNum(kpis.clicks)} delta={pctChange(kpis.clicks, prev.clicks)} />
        <Kpi label="CTR" value={fmtPct(kpis.ctr)} delta={kpis.ctr != null && prev.ctr != null ? kpis.ctr - prev.ctr : null} />
        <Kpi label="Conversions" value={fmtNum(kpis.conversions)} delta={pctChange(kpis.conversions, prev.conversions)} />
        <Kpi label="CPA" value={fmtMoney2(kpis.cpa)} delta={kpis.cpa != null && prev.cpa != null && prev.cpa !== 0 ? ((kpis.cpa - prev.cpa) / prev.cpa) * 100 : null} positiveGood={false} />
        <Kpi label="Revenue" value={fmtMoney(kpis.revenue)} delta={pctChange(kpis.revenue, prev.revenue)} />
        <Kpi label="ROAS" value={kpis.roas != null ? `${kpis.roas.toFixed(2)}x` : "—"} delta={kpis.roas != null && prev.roas != null && prev.roas !== 0 ? ((kpis.roas - prev.roas) / prev.roas) * 100 : null} />
      </div>

      <div className="grid2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Trend</h3>
            <div className="spacer" style={{ flex: 1 }} />
            {METRICS.map((x) => (
              <button
                key={x.key}
                className={"preset" + (metric === x.key ? " on" : "")}
                style={{
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: metric === x.key ? "var(--brand)" : "var(--panel)",
                  color: metric === x.key ? "var(--brand-ink)" : "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setMetric(x.key)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <LineChart series={series} />
        </div>
        <div className="card">
          <h3>Spend by channel</h3>
          {data.channels.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No channel data in this period.</p>
          ) : (
            <BarList
              rows={data.channels.map((c, i) => ({
                label: c.channel,
                value: c.spend,
                color: ["#4f46e5", "#0ea5e9", "#16a34a", "#d97706", "#7c3aed", "#64748b"][i % 6],
              }))}
              format={fmtMoney}
            />
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Channel breakdown</h3>
        <div className="table-wrap" style={{ boxShadow: "none" }}>
          <table className="data">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Spend</th>
                <th className="num">Impr.</th>
                <th className="num">Clicks</th>
                <th className="num">CTR</th>
                <th className="num">Conv.</th>
                <th className="num">CPA</th>
                <th className="num">Revenue</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.channel}>
                  <td style={{ fontWeight: 600 }}>{c.channel}</td>
                  <td className="num">{fmtMoney(c.spend)}</td>
                  <td className="num">{fmtNum(c.impressions)}</td>
                  <td className="num">{fmtNum(c.clicks)}</td>
                  <td className="num">{fmtPct(c.ctr)}</td>
                  <td className="num">{fmtNum(c.conversions)}</td>
                  <td className="num">{fmtMoney2(c.cpa)}</td>
                  <td className="num">{fmtMoney(c.revenue)}</td>
                  <td className="num">{c.roas != null ? `${c.roas.toFixed(2)}x` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Contacts</h3>
          {contacts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No contacts added.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {[c.role, c.email].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))
          )}
          {notes && (
            <>
              <h3 style={{ marginTop: 16 }}>Notes</h3>
              <p style={{ color: "var(--muted)", margin: 0 }}>{notes}</p>
            </>
          )}
        </div>
        <div className="card">
          <h3>Manage</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {editable && (
              <>
                <a className="btn btn-sm" href={`/clients/${clientId}/import`}>Import data</a>
                <a className="btn btn-sm" href={`/clients/${clientId}/report?from=${from}&to=${to}`}>Print report</a>
                <a className="btn btn-sm" href={`/clients/${clientId}/edit`}>Edit client</a>
              </>
            )}
            {!editable && (
              <p style={{ color: "var(--muted)", margin: 0 }}>
                This is a read-only view. Contact your agency for changes.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
