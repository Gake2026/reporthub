"use client";

import { useState } from "react";

export default function SmtpForm({
  initial,
}: {
  initial: {
    smtp_host: string;
    smtp_port: string;
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
  };
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error || "Could not save.");
        return;
      }
      setMsg("Saved.");
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      {err && <div className="alert alert-error">{err}</div>}
      {msg && <div className="alert alert-ok">{msg}</div>}
      <div className="form-row">
        <div className="form-group">
          <label>SMTP host</label>
          <input className="input" value={form.smtp_host} onChange={set("smtp_host")} placeholder="mail.example.com" />
        </div>
        <div className="form-group">
          <label>SMTP port</label>
          <input className="input" value={form.smtp_port} onChange={set("smtp_port")} placeholder="587" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>SMTP username</label>
          <input className="input" value={form.smtp_user} onChange={set("smtp_user")} autoComplete="off" />
        </div>
        <div className="form-group">
          <label>SMTP password</label>
          <input className="input" type="password" value={form.smtp_pass} onChange={set("smtp_pass")} autoComplete="new-password" />
        </div>
      </div>
      <div className="form-group">
        <label>From address</label>
        <input className="input" value={form.smtp_from} onChange={set("smtp_from")} placeholder="reports@example.com" />
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save email settings"}
      </button>
    </div>
  );
}
