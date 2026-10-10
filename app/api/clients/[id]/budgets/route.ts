import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canSeeClient, canEditClient } from "../../../../../lib/auth";
import { getBudgets, upsertBudget } from "../../../../../lib/pacing";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  const month = req.nextUrl.searchParams.get("month") ?? undefined;
  return NextResponse.json({ budgets: getBudgets(clientId, month) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);
  const body = (await req.json().catch(() => ({}))) as {
    channel?: string;
    month?: string;
    amount?: number;
  };
  try {
    upsertBudget(clientId, body.channel ?? "", body.month ?? "", Number(body.amount));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not save budget.");
  }
}
