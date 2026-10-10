import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { visibleClientIds } from "../../../lib/auth";
import { listAlerts, unreadAlertCount, detectAlertsFor } from "../../../lib/alerts";

export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const vis = visibleClientIds(r.user);
  return NextResponse.json({
    alerts: listAlerts(vis),
    unread: unreadAlertCount(vis),
  });
}

/** Re-run swing detection for all visible clients (idempotent per window). */
export async function POST() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const created = detectAlertsFor(visibleClientIds(r.user));
  return NextResponse.json({ ok: true, created });
}
