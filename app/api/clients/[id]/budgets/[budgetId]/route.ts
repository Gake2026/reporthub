import { NextResponse } from "next/server";
import { needUser, bad } from "../../../../../../lib/api";
import { canEditClient } from "../../../../../../lib/auth";
import { deleteBudget } from "../../../../../../lib/pacing";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; budgetId: string }> }
) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const { id, budgetId } = await params;
  const clientId = Number(id);
  const bid = Number(budgetId);
  if (!Number.isFinite(clientId) || !Number.isFinite(bid))
    return bad("Bad request.");
  if (!canEditClient(r.user, clientId)) return bad("Not allowed.", 403);
  const ok = deleteBudget(bid, clientId);
  if (!ok) return bad("Not found.", 404);
  return NextResponse.json({ ok: true });
}
