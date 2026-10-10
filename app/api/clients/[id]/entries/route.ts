import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canEditClient } from "../../../../../lib/auth";
import { upsertManualEntry } from "../../../../../lib/csv";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };
  const entry = {
    date: String(body.date ?? ""),
    channel: String(body.channel ?? ""),
    campaign: String(body.campaign ?? ""),
    impressions: num(body.impressions),
    clicks: num(body.clicks),
    spend: num(body.spend),
    conversions: num(body.conversions),
    revenue: num(body.revenue),
  };
  if (Object.values(entry).some((v) => typeof v === "number" && Number.isNaN(v)))
    return bad("All metric values must be numbers.");
  try {
    upsertManualEntry(clientId, entry as Parameters<typeof upsertManualEntry>[1]);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not save the entry.");
  }
  return NextResponse.json({ ok: true });
}
