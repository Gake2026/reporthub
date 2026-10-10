import { NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { visibleClientIds } from "../../../../../lib/auth";
import { markAlertRead } from "../../../../../lib/alerts";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad alert id.");
  const ok = markAlertRead(id, visibleClientIds(r.user));
  if (!ok) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}
