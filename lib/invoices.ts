// Invoice workspace: CRUD, totals, and status tracking.

import db from "./db";

export interface InvoiceItemInput {
  description: string;
  qty: number;
  rate: number;
}

export interface InvoiceItem extends InvoiceItemInput {
  id: number;
  invoice_id: number;
  position: number;
}

export interface Invoice {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  issue_date: string;
  due_date: string;
  notes: string;
  tax_rate: number;
  status: "draft" | "unpaid" | "paid" | "overdue";
  created_at: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function invoiceTotals(
  items: InvoiceItemInput[],
  taxRate: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = round2(
    items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0)
  );
  const tax = round2(subtotal * ((Number(taxRate) || 0) / 100));
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function nextInvoiceNumber(): string {
  const row = db.prepare("SELECT MAX(id) AS m FROM invoices").get() as { m: number | null };
  return `INV-${String((row.m ?? 0) + 1).padStart(4, "0")}`;
}

function validate(input: {
  client_id: number;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  items: InvoiceItemInput[];
}) {
  if (!Number.isInteger(input.client_id) || input.client_id <= 0)
    throw new Error("A client is required.");
  if (!DATE_RE.test(input.issue_date) || !DATE_RE.test(input.due_date))
    throw new Error("Issue and due dates must be YYYY-MM-DD.");
  if (!Number.isFinite(input.tax_rate) || input.tax_rate < 0 || input.tax_rate > 100)
    throw new Error("Tax rate must be between 0 and 100.");
  if (!Array.isArray(input.items) || input.items.length === 0)
    throw new Error("At least one line item is required.");
  for (const it of input.items) {
    if (!it.description || !it.description.trim())
      throw new Error("Every line item needs a description.");
    if (!Number.isFinite(Number(it.qty)) || Number(it.qty) < 0)
      throw new Error("Quantities must be non-negative numbers.");
    if (!Number.isFinite(Number(it.rate)) || Number(it.rate) < 0)
      throw new Error("Rates must be non-negative numbers.");
  }
}

export function createInvoice(input: {
  client_id: number;
  issue_date: string;
  due_date: string;
  notes?: string;
  tax_rate?: number;
  status?: Invoice["status"];
  items: InvoiceItemInput[];
}): number {
  const tax_rate = input.tax_rate ?? 0;
  validate({ ...input, tax_rate });
  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO invoices (number, client_id, issue_date, due_date, notes, tax_rate, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nextInvoiceNumber(),
        input.client_id,
        input.issue_date,
        input.due_date,
        input.notes ?? "",
        tax_rate,
        input.status ?? "unpaid"
      );
    const invoiceId = Number(res.lastInsertRowid);
    const ins = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, qty, rate, position)
       VALUES (?, ?, ?, ?, ?)`
    );
    input.items.forEach((it, i) =>
      ins.run(invoiceId, it.description.trim(), Number(it.qty), Number(it.rate), i)
    );
    return invoiceId;
  });
  return tx();
}

export function updateInvoice(
  id: number,
  input: {
    client_id: number;
    issue_date: string;
    due_date: string;
    notes?: string;
    tax_rate?: number;
    status?: Invoice["status"];
    items: InvoiceItemInput[];
  }
): void {
  const tax_rate = input.tax_rate ?? 0;
  validate({ ...input, tax_rate });
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE invoices SET client_id = ?, issue_date = ?, due_date = ?, notes = ?, tax_rate = ?, status = ?
       WHERE id = ?`
    ).run(
      input.client_id,
      input.issue_date,
      input.due_date,
      input.notes ?? "",
      tax_rate,
      input.status ?? "unpaid",
      id
    );
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);
    const ins = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, qty, rate, position)
       VALUES (?, ?, ?, ?, ?)`
    );
    input.items.forEach((it, i) =>
      ins.run(id, it.description.trim(), Number(it.qty), Number(it.rate), i)
    );
  });
  tx();
}

export function deleteInvoice(id: number): void {
  db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
}

export function setInvoiceStatus(id: number, status: Invoice["status"]): void {
  if (!["draft", "unpaid", "paid", "overdue"].includes(status))
    throw new Error("Unknown status.");
  db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, id);
}

function toInvoice(row: Record<string, unknown>, items: InvoiceItem[]): Invoice {
  const totals = invoiceTotals(items, Number(row.tax_rate));
  return {
    id: Number(row.id),
    number: String(row.number),
    client_id: Number(row.client_id),
    client_name: String(row.client_name ?? ""),
    issue_date: String(row.issue_date),
    due_date: String(row.due_date),
    notes: String(row.notes ?? ""),
    tax_rate: Number(row.tax_rate),
    status: row.status as Invoice["status"],
    created_at: String(row.created_at),
    items,
    ...totals,
  };
}

function itemsFor(invoiceId: number): InvoiceItem[] {
  return db
    .prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position, id")
    .all(invoiceId) as InvoiceItem[];
}

export function getInvoice(id: number, clientIds: number[] | "all"): Invoice | null {
  const where =
    clientIds === "all"
      ? ""
      : `AND i.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [id] : [id, ...(clientIds as number[])];
  const row = db
    .prepare(
      `SELECT i.*, c.name AS client_name FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.id = ? ${where}`
    )
    .get(...params) as Record<string, unknown> | undefined;
  if (!row) return null;
  return toInvoice(row, itemsFor(id));
}

export function listInvoices(clientIds: number[] | "all"): Invoice[] {
  const where =
    clientIds === "all"
      ? ""
      : `WHERE i.client_id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : (clientIds as number[]);
  const rows = db
    .prepare(
      `SELECT i.*, c.name AS client_name FROM invoices i
       JOIN clients c ON c.id = i.client_id
       ${where} ORDER BY i.created_at DESC, i.id DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map((r) => toInvoice(r, itemsFor(Number(r.id))));
}
