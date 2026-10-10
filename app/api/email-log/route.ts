import { NextResponse } from "next/server";
import { needUser } from "../../../lib/api";
import { visibleClientIds } from "../../../lib/auth";
import { getEmailLog } from "../../../lib/schedules";

export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  return NextResponse.json({ log: getEmailLog(visibleClientIds(r.user)) });
}
