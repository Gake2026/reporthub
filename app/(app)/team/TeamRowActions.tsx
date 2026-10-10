"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamRowActions({
  id,
  name,
  active,
}: {
  id: number;
  name: string;
  active: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (!res.ok) alert("Could not update the account.");
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Remove ${name}'s account? They will lose access immediately.`)) return;
    setBusy(true);
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Could not remove the account.");
    setBusy(false);
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="btn btn-sm" disabled={busy} onClick={toggle}>
        {active ? "Disable" : "Enable"}
      </button>
      <button className="btn btn-sm btn-danger" disabled={busy} onClick={remove}>
        Remove
      </button>
    </span>
  );
}
