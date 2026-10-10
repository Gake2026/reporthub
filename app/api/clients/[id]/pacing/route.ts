import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canSeeClient } from "../../../../../lib/auth";
import { getPacing } from "../../../../../lib/pacing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  const month = req.nextUrl.searchParams.get("month") ?? undefined;
  return NextResponse.json({ pacing: getPacing(clientId, month) });
}
