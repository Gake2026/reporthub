"use client";

import { useRef, useState } from "react";
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

  const logoRef = useRef<HTMLInputElement>(null);

  /* --- logo adjust editor (square crop, drag + zoom) --- */
  const LS = 280; // stage size (CSS px)
  const LD = 240; // square crop size
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [editorErr, setEditorErr] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; dx: number; dy: number } | null>(null);

  function logoBaseScale(): number {
    if (!dims) return 1;
    return Math.max(LS / dims.w, LS / dims.h);
  }
  function logoClampOff(o: { x: number; y: number }, z = zoom) {
    if (!dims) return o;
    const bs = logoBaseScale();
    const mx = Math.max(0, (dims.w * bs * z - LD) / 2);
    const my = Math.max(0, (dims.h * bs * z - LD) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, o.x)),
      y: Math.min(my, Math.max(-my, o.y)),
    };
  }
  function closeLogoEditor() {
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
    setDims(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setEditorErr("");
  }
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    setEditorErr("");
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    // Open the adjust editor instead of using the raw photo.
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setDims(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setEditorSrc(URL.createObjectURL(f));
  }
  function onLogoDragStart(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { sx: e.clientX, sy: e.clientY, dx: off.x, dy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onLogoDragMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    setOff(logoClampOff({ x: d.dx + e.clientX - d.sx, y: d.dy + e.clientY - d.sy }));
  }
  function onLogoDragEnd() {
    dragRef.current = null;
  }
  /** Export the square crop as a capped data URL (PNG first, then JPEG). */
  function exportLogo(): string | null {
    const img = imgRef.current;
    if (!img || !dims) return null;
    const bs = logoBaseScale();
    const cropLeft = (LS - LD) / 2;
    const imgLeft = (LS - dims.w * bs * zoom) / 2 + off.x;
    const imgTop = (LS - dims.h * bs * zoom) / 2 + off.y;
    const sx = (cropLeft - imgLeft) / (bs * zoom);
    const sy = (cropLeft - imgTop) / (bs * zoom);
    const sw = LD / (bs * zoom);
    const size = Math.min(512, Math.max(1, Math.round(sw)));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, size, size);
    const CAP = 330_000;
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
  function useLogo() {
    setEditorErr("");
    const url = exportLogo();
    if (!url) {
      setEditorErr("Could not read the image. Try a different file.");
      return;
    }
    setLogoData(url);
    closeLogoEditor();
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
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  // editor render math
  const lbs = logoBaseScale();
  const ldispW = dims ? dims.w * lbs * zoom : 0;
  const ldispH = dims ? dims.h * lbs * zoom : 0;
  const limgLeft = (LS - ldispW) / 2 + off.x;
  const limgTop = (LS - ldispH) / 2 + off.y;
  const lCropLeft = (LS - LD) / 2;

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
          Any photo works — you&apos;ll crop it to a square next.
        </p>
      </div>

      {editorSrc && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px" }}>Adjust logo</h3>
          <p className="sub" style={{ margin: "0 0 12px" }}>
            Drag the photo to reposition, zoom with the slider. The square shows
            exactly what will be saved as your logo.
          </p>
          {editorErr && <div className="alert alert-error">{editorErr}</div>}
          <div className="editor-grid">
            <div
              onPointerDown={onLogoDragStart}
              onPointerMove={onLogoDragMove}
              onPointerUp={onLogoDragEnd}
              onPointerCancel={onLogoDragEnd}
              style={{
                width: LS,
                height: LS,
                maxWidth: "100%",
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                background: "#0f1220",
                touchAction: "none",
                cursor: "grab",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={editorSrc}
                alt=""
                draggable={false}
                onLoad={(e) =>
                  setDims({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  })
                }
                style={{
                  position: "absolute",
                  left: limgLeft,
                  top: limgTop,
                  width: ldispW,
                  height: ldispH,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              {/* square crop hole */}
              <div
                style={{
                  position: "absolute",
                  left: lCropLeft,
                  top: lCropLeft,
                  width: LD,
                  height: LD,
                  boxShadow: "0 0 0 999px rgba(0,0,0,0.55)",
                  border: "2px solid rgba(255,255,255,0.9)",
                  borderRadius: 10,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            </div>
            <div>
              <label className="field">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => {
                  const z = parseFloat(e.target.value);
                  setZoom(z);
                  setOff((o) => logoClampOff(o, z));
                }}
                style={{ width: "100%", minHeight: 44 }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" onClick={useLogo}>
                  Use this logo
                </button>
                <button type="button" className="btn" onClick={closeLogoEditor}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
