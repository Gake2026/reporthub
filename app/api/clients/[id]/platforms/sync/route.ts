import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../../lib/api";
import { canEditClient } from "../../../../../../lib/auth";
import { syncPlatform, syncAllPlatforms, isKnownPlatform } from "../../../../../../lib/platforms";

/** Sync one platform (or all). Honest stub until provider adapters exist. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);
  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  const platform = body.platform ?? "all";
  if (platform !== "all" && !isKnownPlatform(platform))
    return bad("Unknown platform.");
  const results =
    platform === "all"
      ? syncAllPlatforms(clientId)
      : [syncPlatform(clientId, platform)];
  return NextResponse.json({ ok: true, results });
}
