"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DangerZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function wipeClients() {
    if (
      !window.confirm(
        "Remove ALL clients, contacts, and metrics? User accounts and branding are kept. This cannot be undone."
      )
    )
      return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "clients" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Reset failed.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function restoreDemo() {
    if (
      !window.confirm(
        "Restore the demo dataset? Everything — clients, metrics, users, branding — will be replaced with the original demo data."
      )
    )
      return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "demo" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Reset failed.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="card">
      <h3>Danger zone</h3>
      {msg && <div className="alert alert-error">{msg}</div>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-danger" disabled={busy} onClick={wipeClients}>
          Remove all client data
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={restoreDemo}>
          Restore demo dataset
        </button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
        Use “Remove all client data” before going live with real clients. “Restore
        demo dataset” brings back the original demo agency, clients, and logins.
      </p>
    </div>
  );
}
