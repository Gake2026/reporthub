import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { hashPasswordSync } from "../../../lib/password";
import db from "../../../lib/db";

const ROLES = new Set(["owner", "manager", "client"]);

export async function GET() {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, c.name AS client_name
       FROM users u LEFT JOIN clients c ON c.id = u.client_id ORDER BY u.created_at`
    )
    .all();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    client_id?: number | null;
  };
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!name) return bad("Name is required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("A valid email is required.");
  if (!body.password || body.password.length < 8)
    return bad("Password must be at least 8 characters.");
  if (!body.role || !ROLES.has(body.role)) return bad("Invalid role.");

  let clientId: number | null = null;
  if (body.role === "client") {
    if (!body.client_id) return bad("Client logins must be linked to a client.");
    const c = db.prepare("SELECT id FROM clients WHERE id = ?").get(body.client_id) as
      | { id: number }
      | undefined;
    if (!c) return bad("Selected client does not exist.");
    clientId = c.id;
  }

  const exists = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
    .get(email) as { id: number } | undefined;
  if (exists) return bad("An account with that email already exists.");

  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, client_id) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, email, hashPasswordSync(body.password), body.role, clientId);
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
