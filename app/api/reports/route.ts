import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { visibleClientIds, canSeeClient } from "../../../lib/auth";
import { generateReport, listReports } from "../../../lib/reports";

/** Report library for all visible clients. */
export async function GET(req: NextRequest) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const vis = visibleClientIds(r.user);
  const only = req.nextUrl.searchParams.get("clientId");
  let ids = vis;
  if (only) {
    const cid = Number(only);
    if (!Number.isFinite(cid) || !canSeeClient(r.user, cid))
      return bad("Not found.", 404);
    ids = [cid];
  }
  return NextResponse.json({ reports: listReports(ids) });
}

/**
 * Batch generation. The caller passes the SELECTED period explicitly —
 * from/to flow straight into every generated report and are stored verbatim.
 */
export async function POST(req: NextRequest) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    clientIds?: number[];
    from?: string;
    to?: string;
  };
  const { from = "", to = "" } = body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to)
    return bad("from and to (YYYY-MM-DD) are required.");
  const ids = Array.isArray(body.clientIds) ? body.clientIds : [];
  if (ids.length === 0) return bad("No clients selected.");
  if (ids.length > 100) return bad("Too many clients in one batch (max 100).");

  const results: Array<{ clientId: number; reportId?: number; error?: string }> = [];
  for (const cid of ids) {
    if (!Number.isInteger(cid) || !canSeeClient(r.user, cid)) {
      results.push({ clientId: cid, error: "Not allowed." });
      continue;
    }
    try {
      const reportId = generateReport(cid, from, to);
      results.push({ clientId: cid, reportId });
    } catch (e) {
      results.push({ clientId: cid, error: e instanceof Error ? e.message : "Failed." });
    }
  }
  return NextResponse.json({ ok: true, from, to, results });
}
