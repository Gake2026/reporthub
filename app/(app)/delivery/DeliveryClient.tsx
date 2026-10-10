"use client";

import { useCallback, useEffect, useState } from "react";

interface Client {
  id: number;
  name: string;
}

interface Schedule {
  id: number;
  client_id: number;
  client_name: string;
  frequency: string;
  recipients: string;
  active: number;
  last_sent_at: string | null;
  created_at: string;
}

interface EmailLogRow {
  id: number;
  client_name: string;
  sent_at: string;
  status: string;
  note: string;
}

export default function DeliveryClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [log, setLog] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // create form
  const [clientId, setClientId] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [recipients, setRecipients] = useState("");

  // inline edit state
  const [editing, setEditing] = useState<
    Record<number, { recipients: string; active: boolean }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c, l] = await Promise.all([
        fetch("/api/schedules"),
        fetch("/api/clients"),
        fetch("/api/email-log"),
      ]);
      const sd = (await s.json().catch(() => ({}))) as {
        error?: string;
        schedules?: Schedule[];
      };
      const cd = (await c.json().catch(() => ({}))) as {
        error?: string;
        clients?: Client[];
      };
      const ld = (await l.json().catch(() => ({}))) as {
        error?: string;
        log?: EmailLogRow[];
      };
      if (!s.ok) {
        setError(sd.error || "Could not load schedules.");
      } else {
        setSchedules(sd.schedules ?? []);
        setClients(cd.clients ?? []);
        setLog(ld.log ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: Number(clientId),
          frequency,
          recipients,
          active: 1,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not create the schedule.");
      } else {
        setNotice("Schedule created.");
        setClientId("");
        setFrequency("weekly");
        setRecipients("");
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Schedule) {
    setEditing((e) => ({
      ...e,
      [s.id]: { recipients: s.recipients, active: s.active === 1 },
    }));
  }

  async function saveEdit(s: Schedule) {
    const ed = editing[s.id];
    if (!ed) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/schedules/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: ed.recipients,
          active: ed.active ? 1 : 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update the schedule.");
      } else {
        setNotice("Schedule updated.");
        setEditing((e) => {
          const next = { ...e };
          delete next[s.id];
          return next;
        });
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this schedule?")) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error || "Could not delete the schedule.");
      else {
        setNotice("Schedule deleted.");
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function onSendNow(s: Schedule) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch(`/api/schedules/${s.id}/send`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        note?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not send the report.");
      } else {
        setNotice(
          data.note || `Send requested — status: ${data.status ?? "unknown"}.`
        );
        load();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-ok">{notice}</div>}

      <div className="alert alert-info">
        This demo environment has no mail server, so sends are logged and
        queued. Real delivery needs SMTP configured in Settings by the agency's
        tech team.
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Report schedules</h3>
        <form onSubmit={onCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="field">Client *</label>
              <select
                className="input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="field">Frequency</label>
              <select
                className="input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="form-group">
              <label className="field">Recipients (comma-separated) *</label>
              <input
                className="input"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="team@agency.com, client@brand.com"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? "Working…" : "Create schedule"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Schedules</h3>
        {schedules.length === 0 ? (
          <div className="empty">
            <p>No schedules yet. Create one above.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Frequency</th>
                  <th>Recipients</th>
                  <th>Active</th>
                  <th>Last sent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const ed = editing[s.id];
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.client_name}</td>
                      <td>{s.frequency}</td>
                      <td>
                        {ed ? (
                          <input
                            className="input"
                            style={{ fontSize: 13, padding: "6px 8px" }}
                            value={ed.recipients}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [s.id]: { ...ed, recipients: e.target.value },
                              }))
                            }
                          />
                        ) : (
                          s.recipients || (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )
                        )}
                      </td>
                      <td>
                        {ed ? (
                          <input
                            type="checkbox"
                            checked={ed.active}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [s.id]: { ...ed, active: e.target.checked },
                              }))
                            }
                          />
                        ) : (
                          <span className="badge">
                            {s.active === 1 ? "Active" : "Paused"}
                          </span>
                        )}
                      </td>
                      <td>
                        {s.last_sent_at ?? (
                          <span style={{ color: "var(--muted)" }}>Never</span>
                        )}
                      </td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {ed ? (
                          <>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => saveEdit(s)}
                            >
                              Save
                            </button>{" "}
                            <button
                              className="btn btn-sm"
                              onClick={() =>
                                setEditing((prev) => {
                                  const next = { ...prev };
                                  delete next[s.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-sm"
                              onClick={() => startEdit(s)}
                            >
                              Edit
                            </button>{" "}
                            <button
                              className="btn btn-sm"
                              disabled={busy}
                              onClick={() => onSendNow(s)}
                            >
                              Send now
                            </button>{" "}
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => onDelete(s.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Delivery history</h3>
        {log.length === 0 ? (
          <div className="empty">
            <p>No deliveries logged yet.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Sent at</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.client_name}</td>
                    <td>{row.sent_at}</td>
                    <td>
                      <span className="badge">{row.status}</span>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
