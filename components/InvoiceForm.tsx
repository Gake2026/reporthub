"use client";

import { useMemo, useState } from "react";

export type InvoiceStatus = "draft" | "unpaid" | "paid" | "overdue";

export interface InvoiceItemInput {
  description: string;
  qty: number;
  rate: number;
}

export interface InvoicePayload {
  client_id: number;
  issue_date: string;
  due_date: string;
  notes: string;
  tax_rate: number;
  status: InvoiceStatus;
  items: InvoiceItemInput[];
}

export interface InvoiceInitial {
  client_id: number;
  issue_date: string;
  due_date: string;
  notes: string;
  tax_rate: number;
  status: InvoiceStatus;
  items: Array<{ description: string; qty: number; rate: number }>;
}

const STATUSES: InvoiceStatus[] = ["draft", "unpaid", "paid", "overdue"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

interface RowDraft {
  description: string;
  qty: string;
  rate: string;
}

function blankRow(): RowDraft {
  return { description: "", qty: "1", rate: "" };
}

export default function InvoiceForm({
  clients,
  initial,
  onSubmit,
}: {
  clients: Array<{ id: number; name: string }>;
  initial?: InvoiceInitial;
  onSubmit: (payload: InvoicePayload) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [clientId, setClientId] = useState(
    initial ? String(initial.client_id) : clients[0] ? String(clients[0].id) : ""
  );
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? today());
  const [dueDate, setDueDate] = useState(initial?.due_date ?? today());
  const [taxRate, setTaxRate] = useState(String(initial?.tax_rate ?? 0));
  const [status, setStatus] = useState<InvoiceStatus>(initial?.status ?? "unpaid");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [rows, setRows] = useState<RowDraft[]>(
    initial && initial.items.length > 0
      ? initial.items.map((i) => ({
          description: i.description,
          qty: String(i.qty),
          rate: String(i.rate),
        }))
      : [blankRow()]
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    const subtotal = round2(
      rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0)
    );
    const tax = round2(subtotal * ((Number(taxRate) || 0) / 100));
    return { subtotal, tax, total: round2(subtotal + tax) };
  }, [rows, taxRate]);

  function setRow(i: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const items: InvoiceItemInput[] = [];
    for (const r of rows) {
      const blank = !r.description.trim() && !r.qty.trim() && !r.rate.trim();
      if (blank) continue;
      if (!r.description.trim()) {
        setError("Every line item needs a description.");
        return;
      }
      const qty = Number(r.qty);
      const rate = Number(r.rate);
      if (!Number.isFinite(qty) || qty < 0) {
        setError("Quantities must be non-negative numbers.");
        return;
      }
      if (!Number.isFinite(rate) || rate < 0) {
        setError("Rates must be non-negative numbers.");
        return;
      }
      items.push({ description: r.description.trim(), qty, rate });
    }
    if (items.length === 0) {
      setError("At least one line item is required.");
      return;
    }
    if (!clientId) {
      setError("Choose a client.");
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({
        client_id: Number(clientId),
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim(),
        tax_rate: Number(taxRate) || 0,
        status,
        items,
      });
      if (!result.ok) {
        setError(result.error || "Could not save the invoice.");
        setBusy(false);
      }
      // On success the caller's onSubmit navigates away.
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label className="field">Client *</label>
          <select
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="field">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="field">Issue date *</label>
          <input
            className="input"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="field">Due date *</label>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="field">Tax rate (%)</label>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>
      </div>

      <h3 style={{ margin: "20px 0 10px", fontSize: 14 }}>Line items</h3>
      {rows.map((r, i) => (
        <div className="form-row" key={i} style={{ alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 3 }}>
            <label className="field">Description</label>
            <input
              className="input"
              value={r.description}
              onChange={(e) => setRow(i, { description: e.target.value })}
              placeholder="e.g. Monthly retainer — reporting & analytics"
              maxLength={300}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="field">Qty</label>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={r.qty}
              onChange={(e) => setRow(i, { qty: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="field">Rate (USD)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={r.rate}
              onChange={(e) => setRow(i, { rate: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="form-group" style={{ flex: "0 0 auto" }}>
            <button
              type="button"
              className="btn btn-sm"
              disabled={rows.length <= 1}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Remove row"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setRows((prev) => [...prev, blankRow()])}
      >
        + Add line item
      </button>

      <div className="card" style={{ marginTop: 20, maxWidth: 360 }}>
        <h3>Totals</h3>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "var(--muted)" }}>Subtotal</span>
          <span className="num">${totals.subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "var(--muted)" }}>Tax ({Number(taxRate) || 0}%)</span>
          <span className="num">${totals.tax.toFixed(2)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 16,
            borderTop: "1px solid var(--border)",
            paddingTop: 8,
          }}
        >
          <span>Total</span>
          <span className="num">${totals.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 20 }}>
        <label className="field">Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Payment terms, bank details, anything the client should know."
        />
      </div>

      <div className="spacer" style={{ height: 16 }} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : initial ? "Save changes" : "Create invoice"}
      </button>
    </form>
  );
}
