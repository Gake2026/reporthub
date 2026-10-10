"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteClientButton({
  clientId,
  name,
}: {
  clientId: number;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !window.confirm(
        `Delete "${name}" and all of their data? This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Could not delete the client.");
      setBusy(false);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  return (
    <button className="btn btn-danger" disabled={busy} onClick={onDelete}>
      {busy ? "Deleting…" : "Delete this client"}
    </button>
  );
}
