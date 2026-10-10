"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamForm({
  clients,
}: {
  clients: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (role === "client" && !clientId) {
      setError("Pick which client this login may see.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          client_id: role === "client" ? Number(clientId) : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not create the account.");
        setBusy(false);
        return;
      }
      router.refresh();
      setName("");
      setEmail("");
      setPassword("");
      setRole("manager");
      setClientId("");
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label className="field">Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div className="form-group">
          <label className="field">Email *</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Temporary password *</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        </div>
        <div className="form-group">
          <label className="field">Role *</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="manager">Account manager — sees assigned clients</option>
            <option value="owner">Owner — full access</option>
            <option value="client">Client — read-only, one client</option>
          </select>
        </div>
      </div>
      {role === "client" && (
        <div className="form-group">
          <label className="field">Client this login may see *</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
