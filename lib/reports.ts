// Generated report library: batch generation stores a snapshot per client
// with exact period boundaries, so the library always shows what was sent.

import db from "./db";
import { getPeriodData } from "./metrics";
import { buildSummary } from "./summaries";

export interface StoredReport {
  id: number;
  client_id: number;
  client_name: string;
  period_from: string;
  period_to: string;
  created_at: string;
  snapshot: {
    kpis: Record<string, number | null>;
    channels: Array<Record<string, unknown>>;
    summary: string[];
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Generate + store one report. The caller's from/to are stored verbatim. */
export function generateReport(clientId: number, from: string, to: string): number {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to)
    throw new Error("Bad period.");
  const data = getPeriodData(clientId, from, to);
  const snapshot = {
    kpis: data.kpis,
    channels: data.channels,
    summary: buildSummary(clientId, from, to),
  };
  const res = db
    .prepare(
      `INSERT INTO reports (client_id, period_from, period_to, snapshot)
       VALUES (?, ?, ?, ?)`
    )
    .run(clientId, from, to, JSON.stringify(snapshot));
  return Number(res.lastInsertRowid);
}

function toStored(row: Record<string, unknown>): StoredReport {
  let snapshot: StoredReport["snapshot"] = { kpis: {}, channels: [], summary: [] };
  try {
    snapshot = JSON.parse(String(row.snapshot ?? "{}"));
  } catch {
    /* keep empty snapshot */
  }
  return {
    id: Number(row.id),
    client_id: Number(row.client_id),
    client_name: String(row.client_name ?? ""),
    period_from: String(row.period_from),
    period_to: String(row.period_to),
    created_at: String(row.created_at),
    snapshot,
  };
}

export function getReport(id: number, clientIds: number[] | "all"): StoredReport | null {
  const where =
    clientIds === "all"
      ? ""
      : `AND r.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [id] : [id, ...(clientIds as number[])];
  const row = db
    .prepare(
      `SELECT r.*, c.name AS client_name FROM reports r
       JOIN clients c ON c.id = r.client_id
       WHERE r.id = ? ${where}`
    )
    .get(...params) as Record<string, unknown> | undefined;
  return row ? toStored(row) : null;
}

export function listReports(clientIds: number[] | "all", limit = 200): StoredReport[] {
  const where =
    clientIds === "all"
      ? ""
      : `WHERE r.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : (clientIds as number[]);
  const rows = db
    .prepare(
      `SELECT r.*, c.name AS client_name FROM reports r
       JOIN clients c ON c.id = r.client_id
       ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ?`
    )
    .all(...params, limit) as Array<Record<string, unknown>>;
  return rows.map(toStored);
}
