"use client";

import { useMemo, useRef, useState } from "react";
import { fmtDate } from "../lib/format";

export interface Series {
  name: string;
  color: string;
  points: Array<{ x: string; y: number }>;
  format?: (v: number) => string;
}

const W = 720;
const H = 260;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 30;

/** Clean multi-series SVG line chart with hover tooltip. */
export function LineChart({ series }: { series: Series[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const allY = series.flatMap((s) => s.points.map((p) => p.y));
    const maxY = Math.max(...allY, 1);
    const n = Math.max(...series.map((s) => s.points.length), 1);
    const iw = W - PAD_L - PAD_R;
    const ih = H - PAD_T - PAD_B;
    const x = (i: number) => PAD_L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => PAD_T + ih - (v / maxY) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY);
    const dates = series[0]?.points.map((p) => p.x) ?? [];
    const xTicks: number[] = [];
    if (n > 0) {
      const step = Math.max(1, Math.floor(n / 6));
      for (let i = 0; i < n; i += step) xTicks.push(i);
      if (xTicks[xTicks.length - 1] !== n - 1) xTicks.push(n - 1);
    }
    return { maxY, n, x, y, ticks, dates, xTicks };
  }, [series]);

  const path = (s: Series) =>
    s.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${geom.x(i).toFixed(1)},${geom.y(p.y).toFixed(1)}`)
      .join(" ");

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const iw = W - PAD_L - PAD_R;
    const rel = Math.min(Math.max(svgX - PAD_L, 0), iw);
    const idx =
      geom.n === 1 ? 0 : Math.round((rel / iw) * (geom.n - 1));
    setHover(Math.min(Math.max(idx, 0), geom.n - 1));
  };

  const compact = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
        {geom.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={geom.y(t)}
              y2={geom.y(t)}
              stroke="#e8edf5"
            />
            <text x={PAD_L - 8} y={geom.y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {compact(t)}
            </text>
          </g>
        ))}
        {geom.xTicks.map((i) => (
          <text
            key={i}
            x={geom.x(i)}
            y={H - 10}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
          >
            {fmtDate(geom.dates[i] ?? "").replace(/, \d{4}$/, "")}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" />
            {hover !== null && s.points[hover] && (
              <circle
                cx={geom.x(hover)}
                cy={geom.y(s.points[hover].y)}
                r="4"
                fill={s.color}
                stroke="#fff"
                strokeWidth="1.5"
              />
            )}
          </g>
        ))}
        {hover !== null && (
          <line
            x1={geom.x(hover)}
            x2={geom.x(hover)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="#cbd5e1"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {hover !== null && geom.dates[hover] && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: "var(--muted)",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "var(--text)" }}>{fmtDate(geom.dates[hover])}</strong>
          {series.map((s) => (
            <span key={s.name}>
              <span
                style={{
                  display: "inline-block",
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: s.color,
                  marginRight: 6,
                }}
              />
              {s.name}:{" "}
              <strong style={{ color: "var(--text)" }}>
                {s.format ? s.format(s.points[hover]?.y ?? 0) : compact(s.points[hover]?.y ?? 0)}
              </strong>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.name} style={{ fontSize: 12.5, color: "var(--muted)" }}>
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 3,
                borderRadius: 2,
                background: s.color,
                marginRight: 6,
                verticalAlign: "middle",
              }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar breakdown (e.g. spend by channel). */
export function BarList({
  rows,
  format,
}: {
  rows: Array<{ label: string; value: number; color?: string }>;
  format: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span style={{ fontWeight: 600 }}>{r.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.color,
              }}
            />
          </div>
          <span className="num" style={{ fontVariantNumeric: "tabular-nums" }}>
            {format(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
