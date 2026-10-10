import { NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import { visibleClientIds } from "../../../../lib/auth";
import { getReport } from "../../../../lib/reports";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad report id.");
  const report = getReport(id, visibleClientIds(r.user));
  if (!report) return bad("Not found.", 404);
  return NextResponse.json({ report });
}
