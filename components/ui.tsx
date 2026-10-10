import { fmtDate } from "../lib/format";

/** Small "+12.4% vs prior" delta chip. positiveGood flips the color logic. */
export function Delta({
  pct,
  positiveGood = true,
}: {
  pct: number | null;
  positiveGood?: boolean;
}) {
  if (pct == null || !Number.isFinite(pct))
    return <div className="delta flat">— vs prior</div>;
  const up = pct >= 0;
  const good = positiveGood ? up : !up;
  const cls = pct === 0 ? "flat" : good ? "up" : "down";
  const arrow = pct === 0 ? "" : up ? "↑ " : "↓ ";
  return (
    <div className={`delta ${cls}`}>
      {arrow}
      {Math.abs(pct).toFixed(1)}% vs prior
    </div>
  );
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function Kpi({
  label,
  value,
  delta,
  positiveGood,
}: {
  label: string;
  value: string;
  delta?: number | null;
  positiveGood?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && (
        <Delta pct={delta} positiveGood={positiveGood} />
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  return <span className={`badge ${role}`}>{role}</span>;
}

export function PeriodLabel({ from, to }: { from: string; to: string }) {
  return (
    <span style={{ color: "var(--muted)", fontSize: 13 }}>
      {fmtDate(from)} – {fmtDate(to)}
    </span>
  );
}
