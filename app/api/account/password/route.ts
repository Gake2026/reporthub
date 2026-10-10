import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import db from "../../../../lib/db";
import { hashPasswordSync, verifyPassword } from "../../../../lib/password";

/** Change password: current password + new password (twice, checked client-side). */
export async function POST(req: NextRequest) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    current?: string;
    password?: string;
  };
  const row = db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(r.user.id) as { password_hash: string } | undefined;
  if (!row) return bad("Not found.", 404);
  if (!body.current || !verifyPassword(body.current, row.password_hash))
    return bad("Current password is incorrect.", 403);
  const pw = body.password ?? "";
  if (typeof pw !== "string" || pw.length < 8)
    return bad("New password must be at least 8 characters.");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    hashPasswordSync(pw),
    r.user.id
  );
  return NextResponse.json({ ok: true });
}
