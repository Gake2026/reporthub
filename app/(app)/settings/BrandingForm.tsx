"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgencySettings } from "../../../lib/settings";

export default function BrandingForm({ initial }: { initial: AgencySettings }) {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState(initial.agency_name);
  const [primary, setPrimary] = useState(initial.primary_color);
  const [accent, setAccent] = useState(initial.accent_color);
  const [supportEmail, setSupportEmail] = useState(initial.support_email);
  const [logoData, setLogoData] = useState(initial.logo_data);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 350_000) {
      setError("Logo is too large — please use an image under 350KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoData(String(reader.result || ""));
    reader.readAsDataURL(f);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_name: agencyName.trim() || "ReportHub",
          primary_color: primary,
          accent_color: accent,
          support_email: supportEmail.trim(),
          logo_data: logoData,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save branding.");
        setBusy(false);
        return;
      }
      setOk("Branding saved — it applies everywhere immediately.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-ok">{ok}</div>}
      <div className="form-row">
        <div className="form-group">
          <label className="field">Agency name *</label>
          <input className="input" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} maxLength={80} required />
        </div>
        <div className="form-group">
          <label className="field">Support email (shown on reports)</label>
          <input className="input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} maxLength={200} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="field">Primary color</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} style={{ width: 44, height: 38, padding: 2, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input className="input" value={primary} onChange={(e) => setPrimary(e.target.value)} maxLength={7} style={{ maxWidth: 120 }} />
          </div>
        </div>
        <div className="form-group">
          <label className="field">Accent color</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 44, height: 38, padding: 2, border: "1px solid var(--border)", borderRadius: 8 }} />
            <input className="input" value={accent} onChange={(e) => setAccent(e.target.value)} maxLength={7} style={{ maxWidth: 120 }} />
          </div>
        </div>
      </div>
      <div className="form-group">
        <label className="field">Logo</label>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt="Agency logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, border: "1px solid var(--border)" }} />
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>No logo uploaded</span>
          )}
          <input type="file" accept="image/*" onChange={onLogo} />
          {logoData && (
            <button type="button" className="btn btn-sm" onClick={() => setLogoData("")}>
              Remove
            </button>
          )}
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
