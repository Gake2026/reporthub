"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Metric = "spend" | "conversions" | "ctr" | "cpa";
type Severity = "info" | "warning" | "critical";

interface Alert {
  id: number;
  client_id: number;
  client_name: string;
  metric: Metric;
  direction: "up" | "down";
  message: string;
  severity: Severity;
  period_from: string;
  period_to: string;
  change_pct: number;
  is_read: number;
  created_at: string;
}

interface ClientOption {
  id: number;
  name: string;
}

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: "spend", label: "Ad spend" },
  { key: "conversions", label: "Conversions" },
  { key: "ctr", label: "Click-through rate" },
  { key: "cpa", label: "Cost per acquisition" },
];

const SEVERITY_STYLE: Record<Severity, { background: string; color: string }> = {
  info: { background: "#e0f2fe", color: "#0369a1" },
  warning: { background: "#fef3c7", color: "#b45309" },
  critical: { background: "#fee2e2", color: "#b91c1c" },
};

function fmtPct(pct: number): string {
  const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "";
  return `${arrow} ${Math.abs(pct).toFixed(1)}%`;
}

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [reading, setReading] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [thresholds, setThresholds] = useState<Record<Metric, string> | null>(
    null
  );
  const [saving, setSaving] = useState<Metric | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts");
      if (!res.ok) throw new Error(`Failed to load alerts (${res.status}).`);
      const data = (await res.json()) as { alerts: Alert[]; unread: number };
      setAlerts(data.alerts);
      setUnread(data.unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    fetch("/api/clients")
      .then((res) => (res.ok ? res.json() : { clients: [] }))
      .then((data: { clients: ClientOption[] }) => {
        const list = data.clients ?? [];
        setClients(list);
        if (list.length > 0) setSelectedClient(String(list[0].id));
      })
      .catch(() => {});
  }, [loadAlerts]);

  const loadThresholds = useCallback(async (clientId: string) => {
    if (!clientId) {
      setThresholds(null);
      return;
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/alert-thresholds`);
      if (!res.ok) throw new Error("Failed to load thresholds.");
      const data = (await res.json()) as {
        thresholds: Record<Metric, number>;
      };
      setThresholds({
        spend: String(data.thresholds.spend),
        conversions: String(data.thresholds.conversions),
        ctr: String(data.thresholds.ctr),
        cpa: String(data.thresholds.cpa),
      });
    } catch {
      setThresholds(null);
    }
  }, []);

  useEffect(() => {
    loadThresholds(selectedClient);
  }, [selectedClient, loadThresholds]);

  async function checkNow() {
    setChecking(true);
    setNotice(null);
    try {
      const res = await fetch("/api/alerts", { method: "POST" });
      if (!res.ok) throw new Error(`Detection failed (${res.status}).`);
      const data = (await res.json()) as { ok: boolean; created: number };
      setNotice(
        data.created > 0
          ? `${data.created} new alert${data.created === 1 ? "" : "s"} detected.`
          : "No new alerts detected."
      );
      await loadAlerts();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Detection failed.");
    } finally {
      setChecking(false);
    }
  }

  async function markRead(id: number) {
    setReading(id);
    try {
      const res = await fetch(`/api/alerts/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark alert as read.");
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_read: 1 } : a))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark alert read.");
    } finally {
      setReading(null);
    }
  }

  async function saveThreshold(metric: Metric) {
    if (!selectedClient || !thresholds) return;
    const raw = thresholds[metric].trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) {
      setNotice("Threshold must be a non-negative number (percent).");
      return;
    }
    setSaving(metric);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/clients/${selectedClient}/alert-thresholds`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metric, threshold_pct: value }),
        }
      );
      if (!res.ok) throw new Error(`Save failed (${res.status}).`);
      const data = (await res.json()) as {
        ok: boolean;
        thresholds: Record<Metric, number>;
      };
      setThresholds({
        spend: String(data.thresholds.spend),
        conversions: String(data.thresholds.conversions),
        ctr: String(data.thresholds.ctr),
        cpa: String(data.thresholds.cpa),
      });
      const label = METRICS.find((m) => m.key === metric)?.label ?? metric;
      setNotice(`${label} threshold updated to ${value}% for this client.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <span className="sub">
          {loading
            ? "Loading alerts…"
            : unread > 0
              ? `${unread} unread`
              : "All caught up"}
        </span>
        <div className="spacer" />
        <button
          className="btn btn-primary btn-sm"
          onClick={checkNow}
          disabled={checking}
        >
          {checking ? "Checking…" : "Check now"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-ok" style={{ marginBottom: 20 }}>
          {notice}
        </div>
      )}

      {loading ? (
        <div className="card">
          <p className="sub">Loading alerts…</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty">
          <h3>No alerts yet</h3>
          <p>
            Run a detection check to scan every client for performance swings.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={checkNow}
            disabled={checking}
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>
      ) : (
        <div className="grid" style={{ marginBottom: 24 }}>
          {alerts.map((a) => {
            const metricLabel =
              METRICS.find((m) => m.key === a.metric)?.label ?? a.metric;
            const sev = SEVERITY_STYLE[a.severity];
            const isUnread = !a.is_read;
            return (
              <div
                className="card"
                key={a.id}
                style={isUnread ? { borderLeft: "3px solid #b45309" } : undefined}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Link
                    href={`/clients/${a.client_id}`}
                    style={{ fontWeight: 600 }}
                  >
                    {a.client_name}
                  </Link>
                  <span className="badge" style={sev}>
                    {a.severity}
                  </span>
                  <div className="spacer" />
                  {isUnread && (
                    <button
                      className="btn btn-sm"
                      onClick={() => markRead(a.id)}
                      disabled={reading === a.id}
                    >
                      {reading === a.id ? "Saving…" : "Mark read"}
                    </button>
                  )}
                </div>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>{metricLabel}:</strong> {a.message}
                </p>
                <p className="sub" style={{ margin: 0 }}>
                  {a.period_from} → {a.period_to} · {fmtPct(a.change_pct)} vs
                  prior period
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h3>Alert thresholds</h3>
        <p className="sub" style={{ marginTop: 0 }}>
          Per-client sensitivity: an alert fires when a metric moves more than
          the threshold percent vs the prior period.
        </p>
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Client</label>
            <select
              className="input"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {thresholds ? (
          <div className="form-row">
            {METRICS.map(({ key, label }) => (
              <div className="form-group" key={key}>
                <label>
                  {label} <span className="sub">(%)</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={thresholds[key]}
                    onChange={(e) =>
                      setThresholds((prev) =>
                        prev ? { ...prev, [key]: e.target.value } : prev
                      )
                    }
                  />
                  <button
                    className="btn btn-sm"
                    onClick={() => saveThreshold(key)}
                    disabled={saving === key}
                  >
                    {saving === key ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="sub">
            {clients.length === 0 ? "No clients found." : "Loading thresholds…"}
          </p>
        )}
      </div>
    </>
  );
}
