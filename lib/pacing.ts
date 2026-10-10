// Budget pacing: monthly budgets per client (optionally per channel),
// spend-vs-time-elapsed pacing bars, and off-track status.

import db from "./db";

export interface Budget {
  id: number;
  client_id: number;
  channel: string;
  month: string;
  amount: number;
}

export interface PacingInfo {
  month: string;
  budget: number;
  spend: number;
  dayOfMonth: number;
  daysInMonth: number;
  expected: number;
  ratio: number | null;
  status: "on-track" | "over" | "under" | "no-budget";
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export function getBudgets(clientId: number, month?: string): Budget[] {
  const rows = db
    .prepare(
      `SELECT * FROM budgets WHERE client_id = ? ${month ? "AND month = ?" : ""}
       ORDER BY month DESC, channel`
    )
    .all(...(month ? [clientId, month] : [clientId])) as Budget[];
  return rows;
}

export function upsertBudget(
  clientId: number,
  channel: string,
  month: string,
  amount: number
): void {
  if (!MONTH_RE.test(month)) throw new Error("Month must be YYYY-MM.");
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Budget amount must be a positive number.");
  db.prepare(
    `INSERT INTO budgets (client_id, channel, month, amount)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(client_id, channel, month) DO UPDATE SET amount = excluded.amount`
  ).run(clientId, (channel ?? "").trim(), month, Math.round(amount * 100) / 100);
}

export function deleteBudget(id: number, clientId: number): boolean {
  const res = db
    .prepare("DELETE FROM budgets WHERE id = ? AND client_id = ?")
    .run(id, clientId);
  return res.changes > 0;
}

export function getPacing(clientId: number, month?: string): PacingInfo {
  const today = new Date().toISOString().slice(0, 10);
  const m = month && MONTH_RE.test(month) ? month : today.slice(0, 7);
  const budgetRow = db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) AS total FROM budgets WHERE client_id = ? AND month = ?"
    )
    .get(clientId, m) as { total: number };
  const spendRow = db
    .prepare(
      `SELECT COALESCE(SUM(spend),0) AS spend FROM metrics
       WHERE client_id = ? AND date >= ? AND date <= ?`
    )
    .get(clientId, `${m}-01`, m === today.slice(0, 7) ? today : `${m}-31`) as { spend: number };

  const dayOfMonth =
    m === today.slice(0, 7) ? Number(today.slice(8, 10)) : new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const daysInMonth = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const budget = budgetRow.total;
  const spend = Math.round(spendRow.spend * 100) / 100;
  const expected = Math.round(budget * (dayOfMonth / daysInMonth) * 100) / 100;
  const ratio = expected > 0 ? spend / expected : null;
  const status: PacingInfo["status"] =
    budget <= 0
      ? "no-budget"
      : ratio != null && ratio > 1.15
        ? "over"
        : ratio != null && ratio < 0.6 && dayOfMonth > 7
          ? "under"
          : "on-track";
  return { month: m, budget, spend, dayOfMonth, daysInMonth, expected, ratio, status };
}
