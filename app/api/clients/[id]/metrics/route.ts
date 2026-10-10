import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canSeeClient } from "../../../../../lib/auth";
import { getPeriodData } from "../../../../../lib/metrics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return bad("from and to (YYYY-MM-DD) are required.");
  if (from > to) return bad("from must not be after to.");
  return NextResponse.json(getPeriodData(clientId, from, to));
}
