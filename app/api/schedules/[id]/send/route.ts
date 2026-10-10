import { NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { visibleClientIds } from "../../../../../lib/auth";
import { queueSend } from "../../../../../lib/schedules";
import { getSettings } from "../../../../../lib/settings";

/** Queue a send now. Without SMTP configured this only logs the attempt. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad schedule id.");
  try {
    const settings = getSettings();
    const smtpConfigured = Boolean(settings.smtp_host && settings.smtp_from);
    const result = queueSend(id, visibleClientIds(r.user), smtpConfigured);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not queue send.");
  }
}
