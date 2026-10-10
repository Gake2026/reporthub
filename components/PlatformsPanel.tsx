"use client";

import { useCallback, useEffect, useState } from "react";

interface Platform {
  id: string;
  label: string;
}

interface Connection {
  platform: string;
  platform_label: string;
  account_name: string;
  status: string;
  has_credentials: boolean;
  last_sync_at: string | null;
  last_error: string;
}

export default function PlatformsPanel({
  clientId,
  editable,
}: {
  clientId: number;
  editable: boolean;
}) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { account: string; creds: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/platforms`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        platforms?: Platform[];
        connections?: Connection[];
      };
      if (!res.ok) {
        setError(data.error || "Could not load platforms.");
      } else {
        setPlatforms(data.platforms ?? []);
        setConnections(data.connections ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (platform: string, key: "account" | "creds", value: string) =>
    setForm((f) => ({
      ...f,
      [platform]: {
        account: key === "account" ? value : (f[platform]?.account ?? ""),
        creds: key === "creds" ? value : (f[platform]?.creds ?? ""),
      },
    }));

  async function save(platform: string) {
    setNotice("");
    setBusy(`save-${platform}`);
    try {
      const { account = "", creds = "" } = form[platform] ?? {};
      const res = await fetch(`/api/clients/${clientId}/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          account_name: account || undefined,
          credentials: creds || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        connections?: Connection[];
      };
      if (!res.ok) {
        setNotice(data.error || "Could not save the connection.");
      } else {
        setConnections(data.connections ?? []);
        setNotice("Connection saved.");
        setForm((f) => ({ ...f, [platform]: { account: "", creds: "" } }));
      }
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(platform: string) {
    setNotice("");
    setBusy(`disconnect-${platform}`);
    try {
      const res = await fetch(`/api/clients/${clientId}/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, disconnect: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        connections?: Connection[];
      };
      if (!res.ok) setNotice(data.error || "Could not disconnect.");
      else {
        setConnections(data.connections ?? []);
        setNotice("Disconnected.");
      }
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function sync(platform: string) {
    setNotice("");
    setBusy(`sync-${platform}`);
    try {
      const res = await fetch(`/api/clients/${clientId}/platforms/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: Array<{ ok: boolean; message: string; synced_at: string | null }>;
      };
      if (!res.ok) {
        setNotice(data.error || "Sync failed.");
      } else {
        const msgs = (data.results ?? []).map((r) => r.message).filter(Boolean);
        setNotice(msgs.join(" ") || "Sync finished.");
        load();
      }
    } catch {
      setNotice("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading platforms…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="alert alert-info">
        Live imports stay inactive until the agency's tech team installs real
        provider credentials and adapters at deploy time. CSV import and manual
        entry work today.
      </div>

      {notice && <div className="alert alert-ok">{notice}</div>}

      {editable && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            className="btn btn-sm"
            disabled={busy !== null}
            onClick={() => sync("all")}
          >
            {busy === "sync-all" ? "Syncing…" : "Sync all"}
          </button>
        </div>
      )}

      {platforms.map((p) => {
        const conn = connections.find((c) => c.platform === p.id);
        const f = form[p.id] ?? { account: "", creds: "" };
        return (
          <div
            key={p.id}
            className="card"
            style={{ marginBottom: 12, padding: 16 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <strong>{p.label}</strong>
              <span className="badge">
                {conn?.status ?? "disconnected"}
                {conn?.has_credentials ? " · credentials stored" : ""}
              </span>
            </div>

            {conn?.account_name && (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Account: {conn.account_name}
              </div>
            )}
            {conn?.last_sync_at && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                Last sync: {conn.last_sync_at}
              </div>
            )}
            {conn?.last_error && (
              <div className="alert alert-error" style={{ marginTop: 8 }}>
                {conn.last_error}
              </div>
            )}

            {editable && (
              <div style={{ marginTop: 12 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="field">Account name</label>
                    <input
                      className="input"
                      placeholder={conn?.account_name || "e.g. Main ad account"}
                      value={f.account}
                      onChange={(e) => setField(p.id, "account", e.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field">Credentials</label>
                    <input
                      className="input"
                      type="password"
                      placeholder="paste API key / OAuth token"
                      value={f.creds}
                      onChange={(e) => setField(p.id, "creds", e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy !== null}
                    onClick={() => save(p.id)}
                  >
                    {busy === `save-${p.id}` ? "Saving…" : "Save"}
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={busy !== null}
                    onClick={() => sync(p.id)}
                  >
                    {busy === `sync-${p.id}` ? "Syncing…" : "Sync"}
                  </button>
                  {conn && (
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busy !== null}
                      onClick={() => disconnect(p.id)}
                    >
                      {busy === `disconnect-${p.id}` ? "Working…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
