import { NextResponse } from "next/server";
import { needUser } from "../../../lib/api";
import { visibleClientIds } from "../../../lib/auth";
import db from "../../../lib/db";
import { getHealth } from "../../../lib/health";

/** Health scores for every visible client. */
export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const vis = visibleClientIds(r.user);
  const where = vis === "all" ? "" : `WHERE id IN (${vis.map(() => "?").join(",") || "NULL"})`;
  const rows = db
    .prepare(`SELECT id, name FROM clients ${where} ORDER BY name`)
    .all(...(vis === "all" ? [] : vis)) as Array<{ id: number; name: string }>;
  return NextResponse.json({
    health: rows.map((c) => ({ ...getHealth(c.id), client_name: c.name })),
  });
}
