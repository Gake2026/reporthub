// Scheduled report delivery: per-client weekly/monthly schedules, send
// queue, and send history. There is no mail server in this environment —
// sends are queued/logged honestly and delivery requires SMTP configured
// by the deploying team (Settings → Email delivery).

import db from "./db";

export interface ReportSchedule {
  id: number;
  client_id: number;
  client_name: string;
  frequency: "weekly" | "monthly";
  recipients: string;
  active: number;
  last_sent_at: string | null;
  created_at: string;
}

export interface EmailLogEntry {
  id: number;
  schedule_id: number | null;
  client_id: number;
  client_name: string;
  sent_at: string;
  status: string;
  note: string;
}

const FREQ = new Set(["weekly", "monthly"]);

function cleanRecipients(raw: string): string {
  const emails = raw
    .split(/[,\n;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const e of emails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      throw new Error(`Bad recipient email: ${e}`);
  }
  return [...new Set(emails)].join(", ");
}

export function listSchedules(clientIds: number[] | "all"): ReportSchedule[] {
  const where =
    clientIds === "all"
      ? ""
      : `WHERE s.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : (clientIds as number[]);
  return db
    .prepare(
      `SELECT s.*, c.name AS client_name FROM report_schedules s
       JOIN clients c ON c.id = s.client_id
       ${where} ORDER BY s.created_at DESC`
    )
    .all(...params) as ReportSchedule[];
}

export function createSchedule(input: {
  client_id: number;
  frequency: string;
  recipients: string;
  active?: boolean;
}): number {
  if (!FREQ.has(input.frequency)) throw new Error("Frequency must be weekly or monthly.");
  const res = db
    .prepare(
      `INSERT INTO report_schedules (client_id, frequency, recipients, active)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.client_id,
      input.frequency,
      cleanRecipients(input.recipients ?? ""),
      input.active === false ? 0 : 1
    );
  return Number(res.lastInsertRowid);
}

export function updateSchedule(
  id: number,
  clientIds: number[] | "all",
  input: { frequency?: string; recipients?: string; active?: boolean }
): boolean {
  const where =
    clientIds === "all"
      ? ""
      : `AND client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.frequency !== undefined) {
    if (!FREQ.has(input.frequency)) throw new Error("Frequency must be weekly or monthly.");
    sets.push("frequency = ?");
    vals.push(input.frequency);
  }
  if (input.recipients !== undefined) {
    sets.push("recipients = ?");
    vals.push(cleanRecipients(input.recipients));
  }
  if (input.active !== undefined) {
    sets.push("active = ?");
    vals.push(input.active ? 1 : 0);
  }
  if (sets.length === 0) return false;
  const params = clientIds === "all" ? [id] : [id, ...(clientIds as number[])];
  const res = db
    .prepare(`UPDATE report_schedules SET ${sets.join(", ")} WHERE id = ? ${where}`)
    .run(...vals, ...params);
  return res.changes > 0;
}

export function deleteSchedule(id: number, clientIds: number[] | "all"): boolean {
  const where =
    clientIds === "all"
      ? ""
      : `AND client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [id] : [id, ...(clientIds as number[])];
  const res = db
    .prepare(`DELETE FROM report_schedules WHERE id = ? ${where}`)
    .run(...params);
  return res.changes > 0;
}

export interface QueueResult {
  status: "queued";
  note: string;
}

/** Queue a send now. Honest: without SMTP configured this only logs. */
export function queueSend(
  scheduleId: number,
  clientIds: number[] | "all",
  smtpConfigured: boolean
): QueueResult {
  const where =
    clientIds === "all"
      ? ""
      : `AND s.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [scheduleId] : [scheduleId, ...(clientIds as number[])];
  const sched = db
    .prepare(`SELECT s.* FROM report_schedules s WHERE s.id = ? ${where}`)
    .get(...params) as { id: number; client_id: number } | undefined;
  if (!sched) throw new Error("Schedule not found.");

  const note = smtpConfigured
    ? "Queued for delivery via configured SMTP."
    : "Logged only — no mail server configured. Set SMTP in Settings → Email delivery to send for real.";
  db.prepare(
    `INSERT INTO email_log (schedule_id, client_id, status, note)
     VALUES (?, ?, 'queued', ?)`
  ).run(sched.id, sched.client_id, note);
  db.prepare("UPDATE report_schedules SET last_sent_at = datetime('now') WHERE id = ?").run(
    sched.id
  );
  return { status: "queued", note };
}

export function getEmailLog(clientIds: number[] | "all", limit = 100): EmailLogEntry[] {
  const where =
    clientIds === "all"
      ? ""
      : `WHERE l.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : (clientIds as number[]);
  return db
    .prepare(
      `SELECT l.*, c.name AS client_name FROM email_log l
       JOIN clients c ON c.id = l.client_id
       ${where} ORDER BY l.sent_at DESC, l.id DESC LIMIT ?`
    )
    .all(...params, limit) as EmailLogEntry[];
}
