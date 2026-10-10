"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgencySettings } from "../../../lib/settings";

/** Downscale any image to a small logo-friendly data URL (always < server cap).
 *  Prefers PNG (keeps transparency, great for logos); falls back to JPEG. */
function downscaleLogo(img: HTMLImageElement): string {
  const MAX_SIDE = 512;
  const CAP = 330_000; // chars; server rejects logo_data past 500k
  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  let out = canvas.toDataURL("image/png");
  if (out.length <= CAP) return out;
  let q = 0.9;
  out = canvas.toDataURL("image/jpeg", q);
  while (out.length > CAP && q > 0.3) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

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

  const logoRef = useRef<HTMLInputElement>(null);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    // Downscale on-device so phone photos (often several MB) always fit.
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        setLogoData(downscaleLogo(img));
      } catch {
        setError("Could not read that image. Try a different file.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read that image. Try a different file.");
    };
    img.src = url;
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
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {logoData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoData} alt="Agency logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 10, border: "1px solid var(--border)" }} />
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>No logo uploaded</span>
          )}
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            onChange={onLogo}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => logoRef.current?.click()}
          >
            {logoData ? "Change logo…" : "Upload logo…"}
          </button>
          {logoData && (
            <button type="button" className="btn btn-sm" onClick={() => setLogoData("")}>
              Remove
            </button>
          )}
        </div>
        <p className="sub" style={{ margin: "6px 0 0" }}>
          Any photo works — it&apos;s resized automatically.
        </p>
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
