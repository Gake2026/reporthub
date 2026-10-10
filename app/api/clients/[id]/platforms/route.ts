import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canSeeClient, canEditClient } from "../../../../../lib/auth";
import {
  PLATFORMS,
  getConnections,
  upsertConnection,
  disconnectPlatform,
} from "../../../../../lib/platforms";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not found.", 404);
  return NextResponse.json({ platforms: PLATFORMS, connections: getConnections(clientId) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);
  const body = (await req.json().catch(() => ({}))) as {
    platform?: string;
    account_name?: string;
    credentials?: string;
    disconnect?: boolean;
  };
  try {
    if (body.disconnect) {
      disconnectPlatform(clientId, body.platform ?? "");
    } else {
      upsertConnection(
        clientId,
        body.platform ?? "",
        body.account_name ?? "",
        body.credentials ?? ""
      );
    }
    return NextResponse.json({ ok: true, connections: getConnections(clientId) });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not save connection.");
  }
}
