import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import { canSeeClient, canEditClient } from "../../../../lib/auth";
import db from "../../../../lib/db";

const STATUSES = new Set(["active", "paused", "churned"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
  if (!client) return bad("Not found.", 404);
  const contacts = db
    .prepare("SELECT * FROM client_contacts WHERE client_id = ? ORDER BY name")
    .all(clientId);
  return NextResponse.json({ client, contacts });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    website?: string;
    status?: string;
    retainer?: number;
    manager_id?: number | null;
    notes?: string;
  };
  const updates: string[] = [];
  const vals: Array<string | number | null> = [];

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return bad("Client name is required.");
    updates.push("name = ?");
    vals.push(name);
  }
  if (body.website !== undefined) {
    updates.push("website = ?");
    vals.push(body.website.trim().slice(0, 200));
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return bad("Invalid status.");
    updates.push("status = ?");
    vals.push(body.status);
  }
  if (body.retainer !== undefined) {
    const ret = Number(body.retainer);
    if (!Number.isFinite(ret) || ret < 0) return bad("Retainer must be non-negative.");
    updates.push("retainer = ?");
    vals.push(Math.round(ret * 100) / 100);
  }
  if (body.manager_id !== undefined) {
    if (r.user.role !== "owner") return bad("Only owners can reassign managers.", 403);
    if (body.manager_id === null) {
      updates.push("manager_id = ?");
      vals.push(null);
    } else {
      const m = db
        .prepare("SELECT id FROM users WHERE id = ? AND role = 'manager' AND active = 1")
        .get(body.manager_id) as { id: number } | undefined;
      if (!m) return bad("Selected account manager does not exist.");
      updates.push("manager_id = ?");
      vals.push(m.id);
    }
  }
  if (body.notes !== undefined) {
    updates.push("notes = ?");
    vals.push(body.notes.trim().slice(0, 500));
  }
  if (updates.length === 0) return bad("Nothing to update.");
  vals.push(clientId);
  db.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId)) return bad("Not found.", 404);
  // Detach client-role logins first so their accounts survive without access.
  db.prepare("UPDATE users SET client_id = NULL WHERE client_id = ?").run(clientId);
  const info = db.prepare("DELETE FROM clients WHERE id = ?").run(clientId);
  if (info.changes === 0) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}
