import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import { visibleClientIds } from "../../../../lib/auth";
import { updateSchedule, deleteSchedule } from "../../../../lib/schedules";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad schedule id.");
  const body = (await req.json().catch(() => ({}))) as {
    frequency?: string;
    recipients?: string;
    active?: boolean;
  };
  try {
    const ok = updateSchedule(id, visibleClientIds(r.user), body);
    if (!ok) return bad("Not found.", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not update schedule.");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad schedule id.");
  const ok = deleteSchedule(id, visibleClientIds(r.user));
  if (!ok) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}
