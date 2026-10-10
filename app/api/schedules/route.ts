import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { visibleClientIds, canSeeClient } from "../../../lib/auth";
import { listSchedules, createSchedule } from "../../../lib/schedules";

export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  return NextResponse.json({ schedules: listSchedules(visibleClientIds(r.user)) });
}

export async function POST(req: NextRequest) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    client_id?: number;
    frequency?: string;
    recipients?: string;
    active?: boolean;
  };
  const clientId = Number(body.client_id);
  if (!Number.isInteger(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not allowed.", 403);
  try {
    const id = createSchedule({
      client_id: clientId,
      frequency: body.frequency ?? "",
      recipients: body.recipients ?? "",
      active: body.active,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not create schedule.");
  }
}
