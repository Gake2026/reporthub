"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientForm({
  managers,
  client,
  templates,
}: {
  managers: Array<{ id: number; name: string }>;
  client?: {
    id: number;
    name: string;
    website: string;
    status: string;
    retainer: number;
    manager_id: number | null;
    notes: string;
  };
  templates?: Array<{ id: string; name: string; blurb: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState(client?.name ?? "");
  const [website, setWebsite] = useState(client?.website ?? "");
  const [status, setStatus] = useState(client?.status ?? "active");
  const [retainer, setRetainer] = useState(String(client?.retainer ?? ""));
  const [managerId, setManagerId] = useState(
    client?.manager_id ? String(client.manager_id) : ""
  );
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        website: website.trim(),
        status,
        retainer: retainer === "" ? 0 : Number(retainer),
        manager_id: managerId === "" ? null : Number(managerId),
        notes: notes.trim(),
        ...(!client && template ? { template } : {}),
      };
      const res = await fetch(
        client ? `/api/clients/${client.id}` : "/api/clients",
        {
          method: client ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: number };
      if (!res.ok) {
        setError(data.error || "Could not save the client.");
        setBusy(false);
        return;
      }
      router.push(client ? `/clients/${client.id}` : `/clients/${data.id}`);
      router.refresh();
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
          <label className="field">Client name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </div>
        <div className="form-group">
          <label className="field">Website</label>
          <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" maxLength={200} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <div className="form-group">
          <label className="field">Monthly retainer (USD)</label>
          <input className="input" type="number" min="0" step="0.01" value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Account manager</label>
          <select className="input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Unassigned</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="field">Notes</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
      </div>
      {!client && templates && templates.length > 0 && (
        <div className="form-group">
          <label className="field">Onboarding template</label>
          <select
            className="input"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {template && (
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              {templates.find((t) => t.id === template)?.blurb}
            </p>
          )}
        </div>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : client ? "Save changes" : "Add client"}
      </button>
    </form>
  );
}
