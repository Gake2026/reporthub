import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../lib/api";
import { visibleClientIds, canSeeClient } from "../../../../lib/auth";
import {
  getInvoice,
  updateInvoice,
  deleteInvoice,
  setInvoiceStatus,
} from "../../../../lib/invoices";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad invoice id.");
  const inv = getInvoice(id, visibleClientIds(r.user));
  if (!inv) return bad("Not found.", 404);
  return NextResponse.json({ invoice: inv });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad invoice id.");
  const body = (await req.json().catch(() => ({}))) as {
    client_id?: number;
    issue_date?: string;
    due_date?: string;
    notes?: string;
    tax_rate?: number;
    status?: "draft" | "unpaid" | "paid" | "overdue";
    items?: Array<{ description: string; qty: number; rate: number }>;
  };
  const existing = getInvoice(id, visibleClientIds(r.user));
  if (!existing) return bad("Not found.", 404);
  const clientId = Number(body.client_id ?? existing.client_id);
  if (!canSeeClient(r.user, clientId)) return bad("Not allowed.", 403);
  try {
    updateInvoice(id, {
      client_id: clientId,
      issue_date: body.issue_date ?? existing.issue_date,
      due_date: body.due_date ?? existing.due_date,
      notes: body.notes ?? existing.notes,
      tax_rate: body.tax_rate ?? existing.tax_rate,
      status: body.status ?? existing.status,
      items: body.items ?? existing.items,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not update invoice.");
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner", "manager"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad invoice id.");
  const existing = getInvoice(id, visibleClientIds(r.user));
  if (!existing) return bad("Not found.", 404);
  const body = (await req.json().catch(() => ({}))) as {
    status?: "draft" | "unpaid" | "paid" | "overdue";
  };
  try {
    setInvoiceStatus(id, body.status ?? "unpaid");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not update status.");
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const id = Number((await params).id);
  if (!Number.isFinite(id)) return bad("Bad invoice id.");
  const existing = getInvoice(id, visibleClientIds(r.user));
  if (!existing) return bad("Not found.", 404);
  deleteInvoice(id);
  return NextResponse.json({ ok: true });
}
