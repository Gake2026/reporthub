// Client health score: 0–100 per client, computed from data only.
// Signals: last-30-day anomaly count weighted by severity (read/unread state
// is NEVER consulted), performance trend vs prior period, budget pacing, and
// reporting engagement. Fully deterministic — computed from data only.

import db from "./db";
import { getPeriodData } from "./metrics";
import { recentAnomalyCounts } from "./alerts";

export type HealthFlag = "healthy" | "watch" | "at-risk";

export interface HealthDriver {
  label: string;
  detail: string;
  impact: number; // points subtracted (0 when neutral/positive)
}

export interface HealthScore {
  client_id: number;
  score: number;
  flag: HealthFlag;
  drivers: HealthDriver[];
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function getHealth(clientId: number): HealthScore {
  const drivers: HealthDriver[] = [];
  let score = 100;

  const deduct = (label: string, detail: string, points: number) => {
    if (points > 0) {
      score -= points;
      drivers.push({ label, detail, impact: Math.round(points) });
    } else {
      drivers.push({ label, detail, impact: 0 });
    }
  };

  // 1) Anomalies (last 30 days, severity-weighted; read state ignored).
  const counts = recentAnomalyCounts(clientId);
  const anomalyHit = Math.min(
    40,
    counts.critical * 15 + counts.warning * 8 + counts.info * 3
  );
  deduct(
    "Recent anomalies",
    counts.critical + counts.warning + counts.info === 0
      ? "No anomalies detected in the last 30 days."
      : `${counts.critical} critical, ${counts.warning} warning, ${counts.info} info in the last 30 days.`,
    anomalyHit
  );

  // 2) Performance trend: conversions and CPA vs prior 30 days.
  const to = shiftDays(new Date().toISOString().slice(0, 10), -1);
  const from = shiftDays(to, -29);
  const data = getPeriodData(clientId, from, to);
  const convPct = pct(data.kpis.conversions, data.prev.conversions);
  if (convPct != null && convPct < -10) {
    deduct(
      "Conversion trend",
      `Conversions down ${Math.abs(convPct).toFixed(1)}% vs the prior 30 days.`,
      convPct < -25 ? 15 : 8
    );
  } else {
    deduct(
      "Conversion trend",
      convPct == null
        ? "Not enough prior data to judge the trend."
        : `Conversions ${convPct >= 0 ? "up" : "down"} ${Math.abs(convPct).toFixed(1)}% vs the prior 30 days.`,
      0
    );
  }
  const cpaPct = pct(data.kpis.cpa ?? 0, data.prev.cpa ?? 0);
  if (cpaPct != null && cpaPct > 25) {
    deduct(
      "Cost efficiency",
      `Cost per acquisition up ${cpaPct.toFixed(1)}% vs the prior 30 days.`,
      cpaPct > 50 ? 12 : 7
    );
  } else {
    deduct("Cost efficiency", "Acquisition cost is stable or improving.", 0);
  }

  // 3) Budget pacing for the current month.
  const month = to.slice(0, 7);
  const budgetRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) AS total FROM budgets WHERE client_id = ? AND month = ?"
    )
    .get(clientId, month) as { total: number };
  const spendRow = db
    .prepare(
      `SELECT COALESCE(SUM(spend),0) AS spend FROM metrics
       WHERE client_id = ? AND date >= ? AND date <= ?`
    )
    .get(clientId, `${month}-01`, to) as { spend: number };
  if (budgetRow.total > 0) {
    const dayOfMonth = Number(to.slice(8, 10));
    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const expected = budgetRow.total * (dayOfMonth / daysInMonth);
    const ratio = expected > 0 ? spendRow.spend / expected : 1;
    if (ratio > 1.15) {
      deduct(
        "Budget pacing",
        `Spend is running ${Math.round((ratio - 1) * 100)}% ahead of pace for ${month}.`,
        10
      );
    } else if (ratio < 0.6 && dayOfMonth > 7) {
      deduct(
        "Budget pacing",
        `Spend is running ${Math.round((1 - ratio) * 100)}% behind pace for ${month} — budget may go unused.`,
        5
      );
    } else {
      deduct("Budget pacing", `Spend is on pace for the ${month} budget.`, 0);
    }
  } else {
    deduct("Budget pacing", "No monthly budget set for this client.", 0);
  }

  // 4) Reporting engagement: any report or scheduled delivery in 60 days.
  const cutoff = shiftDays(to, -60);
  const repCount = (
    db.prepare(
      `SELECT COUNT(*) AS c FROM reports WHERE client_id = ? AND date(created_at) >= date(?)`
    ).get(clientId, cutoff) as { c: number }
  ).c;
  const schedActive = (
    db.prepare(
      `SELECT COUNT(*) AS c FROM report_schedules WHERE client_id = ? AND active = 1`
    ).get(clientId) as { c: number }
  ).c;
  if (repCount === 0 && schedActive === 0) {
    deduct(
      "Reporting engagement",
      "No reports generated or scheduled in the last 60 days.",
      5
    );
  } else {
    deduct(
      "Reporting engagement",
      `${repCount} report${repCount === 1 ? "" : "s"} generated in the last 60 days` +
        (schedActive > 0 ? ", automated delivery active." : "."),
      0
    );
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const flag: HealthFlag = score >= 75 ? "healthy" : score >= 50 ? "watch" : "at-risk";
  return { client_id: clientId, score, flag, drivers };
}

export function getHealthFor(clientIds: number[] | "all"): HealthScore[] {
  const ids =
    clientIds === "all"
      ? (db.prepare("SELECT id FROM clients").all() as Array<{ id: number }>).map((r) => r.id)
      : clientIds;
  return ids.map(getHealth);
}
