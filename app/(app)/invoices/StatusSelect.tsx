"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["draft", "unpaid", "paid", "overdue"];

/** Quick status change: PATCH /api/invoices/[id] {status}. */
export default function StatusSelect({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setValue(prev);
      } else {
        router.refresh();
      }
    } catch {
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className="input"
      style={{ maxWidth: 130, padding: "6px 10px", fontSize: 13 }}
      value={value}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Invoice status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
