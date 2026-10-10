// Anomaly alerts: period-over-period swing detection over the last 30 days
// vs the prior 30 days. Deterministic, data-driven. Health scores and all
// other consumers must NEVER depend on alert read/unread state — only on
// anomaly counts weighted by severity.

import db from "./db";
import { getPeriodData, type Kpis } from "./metrics";

export type AlertMetric = "spend" | "conversions" | "ctr" | "cpa";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: number;
  client_id: number;
  client_name: string;
  metric: AlertMetric;
  direction: "up" | "down";
  message: string;
  severity: AlertSeverity;
  period_from: string;
  period_to: string;
  prev_from: string;
  prev_to: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
  is_read: number;
  created_at: string;
}

export const ALERT_METRICS: AlertMetric[] = ["spend", "conversions", "ctr", "cpa"];

export const DEFAULT_THRESHOLDS: Record<AlertMetric, number> = {
  spend: 30,
  conversions: 30,
  ctr: 25,
  cpa: 25,
};

const METRIC_LABEL: Record<AlertMetric, string> = {
  spend: "Ad spend",
  conversions: "Conversions",
  ctr: "Click-through rate",
  cpa: "Cost per acquisition",
};

export function getThresholds(clientId: number): Record<AlertMetric, number> {
  const out = { ...DEFAULT_THRESHOLDS };
  const rows = db
    .prepare("SELECT metric, threshold_pct FROM alert_thresholds WHERE client_id = ?")
    .all(clientId) as Array<{ metric: string; threshold_pct: number }>;
  for (const r of rows) {
    if (r.metric in out)
      out[r.metric as AlertMetric] = r.threshold_pct;
  }
  return out;
}

export function setThreshold(clientId: number, metric: string, pct: number): void {
  if (!ALERT_METRICS.includes(metric as AlertMetric))
    throw new Error("Unknown metric.");
  if (!Number.isFinite(pct) || pct < 1 || pct > 500)
    throw new Error("Threshold must be between 1 and 500 percent.");
  db.prepare(
    `INSERT INTO alert_thresholds (client_id, metric, threshold_pct)
     VALUES (?, ?, ?)
     ON CONFLICT(client_id, metric) DO UPDATE SET threshold_pct = excluded.threshold_pct`
  ).run(clientId, metric, pct);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function metricValue(k: Kpis, m: AlertMetric): number | null {
  const v = k[m];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildMessage(metric: AlertMetric, direction: "up" | "down", pct: number): string {
  const verb = direction === "up" ? "rose" : "fell";
  const label = METRIC_LABEL[metric];
  return `${label} ${verb} ${Math.abs(pct).toFixed(1)}% vs the prior 30 days.`;
}

/**
 * Run swing detection for one client and persist any new alerts.
 * Returns the number of alerts created. Idempotent per 30-day window:
 * re-running for the same window creates nothing new.
 */
export function detectAlerts(clientId: number): number {
  const to = shiftDays(new Date().toISOString().slice(0, 10), -1);
  const from = shiftDays(to, -29);
  const data = getPeriodData(clientId, from, to);
  const thresholds = getThresholds(clientId);
  const prevFrom = shiftDays(from, -30);
  const prevTo = shiftDays(from, -1);

  let created = 0;
  const exists = db.prepare(
    `SELECT 1 FROM alerts WHERE client_id = ? AND metric = ? AND period_from = ? AND period_to = ? LIMIT 1`
  );
  const ins = db.prepare(
    `INSERT INTO alerts (client_id, metric, direction, message, severity,
      period_from, period_to, prev_from, prev_to,
      current_value, previous_value, change_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const metric of ALERT_METRICS) {
    const cur = metricValue(data.kpis, metric);
    const prev = metricValue(data.prev, metric);
    if (cur == null || prev == null || prev === 0) continue;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    const threshold = thresholds[metric];
    if (Math.abs(pct) < threshold) continue;
    if (exists.get(clientId, metric, from, to)) continue;

    const direction = pct >= 0 ? "up" : "down";
    const severity: AlertSeverity =
      Math.abs(pct) >= Math.max(60, threshold * 2) ? "critical" : "warning";
    ins.run(
      clientId,
      metric,
      direction,
      buildMessage(metric, direction, pct),
      severity,
      from,
      to,
      prevFrom,
      prevTo,
      Math.round(cur * 100) / 100,
      Math.round(prev * 100) / 100,
      Math.round(pct * 10) / 10
    );
    created++;
  }
  return created;
}

/** Run detection for every client the caller may see; returns total created. */
export function detectAlertsFor(clientIds: number[] | "all"): number {
  const ids =
    clientIds === "all"
      ? (db.prepare("SELECT id FROM clients").all() as Array<{ id: number }>).map((r) => r.id)
      : clientIds;
  let total = 0;
  for (const id of ids) total += detectAlerts(id);
  return total;
}

export function listAlerts(clientIds: number[] | "all", limit = 100): Alert[] {
  const where =
    clientIds === "all"
      ? ""
      : `WHERE a.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : clientIds;
  return db
    .prepare(
      `SELECT a.*, c.name AS client_name
       FROM alerts a JOIN clients c ON c.id = a.client_id
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`
    )
    .all(...params, limit) as Alert[];
}

export function unreadAlertCount(clientIds: number[] | "all"): number {
  const where =
    clientIds === "all"
      ? ""
      : `AND client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : (clientIds as number[]);
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM alerts WHERE is_read = 0 ${where}`)
    .get(...params) as { c: number };
  return row.c;
}

export function markAlertRead(alertId: number, clientIds: number[] | "all"): boolean {
  const where =
    clientIds === "all"
      ? ""
      : `AND client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [alertId] : [alertId, ...(clientIds as number[])];
  const res = db
    .prepare(`UPDATE alerts SET is_read = 1 WHERE id = ? ${where}`)
    .run(...params);
  return res.changes > 0;
}

/** Anomaly counts weighted by severity over the last 30 days — the ONLY
 *  anomaly signal health scoring may use. is_read is deliberately ignored. */
export function recentAnomalyCounts(clientId: number): {
  critical: number;
  warning: number;
  info: number;
} {
  const since = shiftDays(new Date().toISOString().slice(0, 10), -30);
  const rows = db
    .prepare(
      `SELECT severity, COUNT(*) AS c FROM alerts
       WHERE client_id = ? AND date(created_at) >= date(?)
       GROUP BY severity`
    )
    .all(clientId, since) as Array<{ severity: string; c: number }>;
  const out = { critical: 0, warning: 0, info: 0 };
  for (const r of rows) {
    if (r.severity === "critical") out.critical = r.c;
    else if (r.severity === "warning") out.warning = r.c;
    else out.info += r.c;
  }
  return out;
}
