import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { visibleClientIds, canSeeClient } from "../../../lib/auth";
import { listInvoices, createInvoice } from "../../../lib/invoices";

export async function GET() {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  return NextResponse.json({ invoices: listInvoices(visibleClientIds(r.user)) });
}

export async function POST(req: NextRequest) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as {
    client_id?: number;
    issue_date?: string;
    due_date?: string;
    notes?: string;
    tax_rate?: number;
    status?: "draft" | "unpaid" | "paid" | "overdue";
    items?: Array<{ description: string; qty: number; rate: number }>;
  };
  const clientId = Number(body.client_id);
  if (!Number.isInteger(clientId) || !canSeeClient(r.user, clientId))
    return bad("Not allowed.", 403);
  try {
    const id = createInvoice({
      client_id: clientId,
      issue_date: body.issue_date ?? "",
      due_date: body.due_date ?? "",
      notes: body.notes,
      tax_rate: body.tax_rate,
      status: body.status,
      items: body.items ?? [],
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not create invoice.");
  }
}
