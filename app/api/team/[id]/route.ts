import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import { hashPasswordSync } from "../../../../lib/password";
import db from "../../../../lib/db";

const ROLES = new Set(["owner", "manager", "client"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const userId = Number((await params).id);
  if (!Number.isFinite(userId)) return bad("Not found.", 404);
  if (userId === r.user.id) return bad("You cannot change your own account here.", 403);

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    role?: string;
    active?: boolean;
    password?: string;
    client_id?: number | null;
  };
  const updates: string[] = [];
  const vals: Array<string | number | null> = [];

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return bad("Name is required.");
    updates.push("name = ?");
    vals.push(name);
  }
  if (body.role !== undefined) {
    if (!ROLES.has(body.role)) return bad("Invalid role.");
    updates.push("role = ?");
    vals.push(body.role);
    if (body.role !== "client") {
      updates.push("client_id = ?");
      vals.push(null);
    }
  }
  if (body.active !== undefined) {
    updates.push("active = ?");
    vals.push(body.active ? 1 : 0);
  }
  if (body.password !== undefined && body.password !== "") {
    if (body.password.length < 8) return bad("Password must be at least 8 characters.");
    updates.push("password_hash = ?");
    vals.push(hashPasswordSync(body.password));
  }
  if (body.client_id !== undefined) {
    if (body.client_id === null) {
      updates.push("client_id = ?");
      vals.push(null);
    } else {
      const c = db.prepare("SELECT id FROM clients WHERE id = ?").get(body.client_id) as
        | { id: number }
        | undefined;
      if (!c) return bad("Selected client does not exist.");
      updates.push("client_id = ?");
      vals.push(c.id);
    }
  }
  if (updates.length === 0) return bad("Nothing to update.");
  // Disabling a user kills their sessions too.
  if (body.active === false) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
  vals.push(userId);
  const info = db
    .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
    .run(...vals);
  if (info.changes === 0) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const userId = Number((await params).id);
  if (!Number.isFinite(userId)) return bad("Not found.", 404);
  if (userId === r.user.id) return bad("You cannot remove your own account.", 403);
  const info = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  if (info.changes === 0) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}
