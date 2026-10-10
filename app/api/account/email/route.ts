import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import db from "../../../../lib/db";
import { verifyPassword } from "../../../../lib/password";

/** Change email: current password + new email (must be unique). */
export async function POST(req: NextRequest) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    current?: string;
    email?: string;
  };
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(r.user.id) as { password_hash: string } | undefined;
  if (!row) return bad("Not found.", 404);
  if (!body.current || !verifyPassword(body.current, row.password_hash))
    return bad("Current password is incorrect.", 403);
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return bad("Enter a valid email address.");
  const taken = db
    .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
    .get(email, r.user.id);
  if (taken) return bad("That email is already in use.");
  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, r.user.id);
  return NextResponse.json({ ok: true, email });
}
