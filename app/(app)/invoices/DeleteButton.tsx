"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDelete() {
    if (!window.confirm(`Delete invoice ${label}? This cannot be undone.`)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not delete the invoice.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        disabled={busy}
        onClick={onDelete}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <span style={{ color: "#b91c1c", fontSize: 12, marginLeft: 8 }}>{error}</span>
      )}
    </span>
  );
}
