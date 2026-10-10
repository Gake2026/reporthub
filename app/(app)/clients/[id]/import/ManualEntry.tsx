"use client";

import { useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);

export default function ManualEntry({ clientId }: { clientId: number }) {
  const [date, setDate] = useState(today());
  const [channel, setChannel] = useState("");
  const [campaign, setCampaign] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [spend, setSpend] = useState("");
  const [conversions, setConversions] = useState("");
  const [revenue, setRevenue] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          channel,
          campaign,
          impressions: impressions === "" ? 0 : Number(impressions),
          clicks: clicks === "" ? 0 : Number(clicks),
          spend: spend === "" ? 0 : Number(spend),
          conversions: conversions === "" ? 0 : Number(conversions),
          revenue: revenue === "" ? 0 : Number(revenue),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save the entry.");
        setBusy(false);
        return;
      }
      setOk("Entry saved.");
      setChannel("");
      setCampaign("");
      setImpressions("");
      setClicks("");
      setSpend("");
      setConversions("");
      setRevenue("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-ok">{ok}</div>}
      <div className="form-row">
        <div className="form-group">
          <label className="field">Date *</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="field">Channel</label>
          <input className="input" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Google Ads" maxLength={80} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Campaign</label>
          <input className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={120} />
        </div>
        <div className="form-group">
          <label className="field">Impressions</label>
          <input type="number" min="0" step="1" className="input" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Clicks</label>
          <input type="number" min="0" step="1" className="input" value={clicks} onChange={(e) => setClicks(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="field">Spend (USD)</label>
          <input type="number" min="0" step="0.01" className="input" value={spend} onChange={(e) => setSpend(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Conversions</label>
          <input type="number" min="0" step="1" className="input" value={conversions} onChange={(e) => setConversions(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="field">Revenue (USD)</label>
          <input type="number" min="0" step="0.01" className="input" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save entry"}
      </button>
    </form>
  );
}
