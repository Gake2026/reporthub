import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import db from "../../../lib/db";

/** Current user's public profile. */
export async function GET() {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const row = db
    .prepare("SELECT id, name, email, role, avatar FROM users WHERE id = ?")
    .get(r.user.id) as
    | { id: number; name: string; email: string; role: string; avatar: string }
    | undefined;
  if (!row) return bad("Not found.", 404);
  return NextResponse.json({ user: row });
}

/** Update display name and/or profile picture (data URL, ~350KB cap). */
export async function PATCH(req: NextRequest) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    avatar?: string;
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.name !== undefined) {
    const name = body.name.trim().slice(0, 120);
    if (!name) return bad("Display name cannot be empty.");
    sets.push("name = ?");
    vals.push(name);
  }
  if (body.avatar !== undefined) {
    const avatar = body.avatar;
    if (typeof avatar !== "string") return bad("Bad avatar.");
    if (avatar && avatar.length > 500_000)
      return bad("Profile picture is too large (max ~350KB).");
    if (avatar && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(avatar))
      return bad("Profile picture must be a PNG, JPEG, WEBP, or GIF data URL.");
    sets.push("avatar = ?");
    vals.push(avatar);
  }
  if (sets.length === 0) return bad("Nothing to update.");
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, r.user.id);
  return NextResponse.json({ ok: true });
}
