import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canSeeClient, canEditClient } from "../../../../../lib/auth";
import { getThresholds, setThreshold } from "../../../../../lib/alerts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  return NextResponse.json({ thresholds: getThresholds(clientId) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);
  const body = (await req.json().catch(() => ({}))) as {
    metric?: string;
    threshold_pct?: number;
  };
  try {
    setThreshold(clientId, body.metric ?? "", Number(body.threshold_pct));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Bad threshold.");
  }
  return NextResponse.json({ ok: true, thresholds: getThresholds(clientId) });
}
