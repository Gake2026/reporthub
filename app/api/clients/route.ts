import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { visibleClientIds } from "../../../lib/auth";
import { applyTemplate, getTemplate } from "../../../lib/templates";
import db from "../../../lib/db";

const STATUSES = new Set(["active", "paused", "churned"]);

export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const vis = visibleClientIds(r.user);
  const where = vis === "all" ? "" : `WHERE c.id IN (${vis.map(() => "?").join(",") || "NULL"})`;
  const rows = db
    .prepare(
      `SELECT c.*, u.name AS manager_name FROM clients c
       LEFT JOIN users u ON u.id = c.manager_id ${where} ORDER BY c.name`
    )
    .all(...(vis === "all" ? [] : vis));
  return NextResponse.json({ clients: rows });
}

export async function POST(req: NextRequest) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    website?: string;
    status?: string;
    retainer?: number;
    manager_id?: number | null;
    notes?: string;
    template?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) return bad("Client name is required.");
  const status = body.status && STATUSES.has(body.status) ? body.status : "active";
  const retainer = Number(body.retainer);
  if (!Number.isFinite(retainer) || retainer < 0)
    return bad("Retainer must be a non-negative number.");
  let managerId: number | null = null;
  if (body.manager_id != null) {
    const m = db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'manager' AND active = 1")
      .get(body.manager_id) as { id: number } | undefined;
    if (!m) return bad("Selected account manager does not exist.");
    managerId = m.id;
  }
  const info = db
    .prepare(
      `INSERT INTO clients (name, website, status, retainer, manager_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      (body.website ?? "").trim().slice(0, 200),
      status,
      Math.round(retainer * 100) / 100,
      managerId,
      (body.notes ?? "").trim().slice(0, 500)
    );
  const clientId = Number(info.lastInsertRowid);
  let templateName: string | null = null;
  if (body.template) {
    const t = getTemplate(body.template);
    if (!t) return bad("Unknown onboarding template.");
    applyTemplate(clientId, t.id);
    templateName = t.name;
  }
  return NextResponse.json({ ok: true, id: clientId, template: templateName });
}
