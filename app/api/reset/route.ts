import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { wipeAll, seedDemo } from "../../../lib/seed";
import db from "../../../lib/db";

/**
 * Owner-only data management.
 * mode=clients → remove all clients, contacts, metrics (keep users+branding).
 * mode=demo → wipe everything and restore the original demo dataset.
 */
export async function POST(req: NextRequest) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as { mode?: string };

  if (body.mode === "clients") {
    wipeAll(true);
    return NextResponse.json({ ok: true });
  }
  if (body.mode === "demo") {
    wipeAll(false);
    seedDemo();
    // Sessions died with the users; force a fresh login.
    db.exec("DELETE FROM sessions");
    return NextResponse.json({ ok: true });
  }
  return bad("Unknown mode.");
}
