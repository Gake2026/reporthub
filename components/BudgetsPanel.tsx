"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtMoney2 } from "../lib/format";

interface Budget {
  id: number;
  client_id: number;
  channel: string;
  month: string;
  amount: number;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetsPanel({
  clientId,
  editable,
}: {
  clientId: number;
  editable: boolean;
}) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/budgets`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        budgets?: Budget[];
      };
      if (!res.ok) setError(data.error || "Could not load budgets.");
      else setBudgets(data.budgets ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channel.trim() || undefined,
          month: month.trim(),
          amount: Number(amount),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save the budget.");
      } else {
        setNotice("Budget saved.");
        setChannel("");
        setAmount("");
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this budget?")) return;
    setNotice("");
    try {
      const res = await fetch(`/api/clients/${clientId}/budgets/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error || "Could not delete the budget.");
      else {
        setNotice("Budget deleted.");
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading budgets…</p>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

      {editable && (
        <form onSubmit={onAdd} style={{ marginBottom: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="field">Channel (optional)</label>
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="All channels"
                maxLength={80}
              />
            </div>
            <div className="form-group">
              <label className="field">Month (YYYY-MM)</label>
              <input
                className="input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="2026-10"
                pattern="\d{4}-\d{2}"
                maxLength={7}
                required
              />
            </div>
            <div className="form-group">
              <label className="field">Amount (USD)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? "Saving…" : "Add / update budget"}
          </button>
        </form>
      )}

      {budgets.length === 0 ? (
        <div className="empty">
          <p>No budgets set yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Month</th>
                <th>Channel</th>
                <th className="num">Amount</th>
                {editable && <th></th>}
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id}>
                  <td>{b.month}</td>
                  <td>{b.channel || "All channels"}</td>
                  <td className="num">{fmtMoney2(b.amount)}</td>
                  {editable && (
                    <td className="num">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onDelete(b.id)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
