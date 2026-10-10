"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "../../../components/Avatar";

/* Editor geometry (CSS px): square stage S, circular crop of diameter D,
   circular live preview of diameter P. */
const S = 280;
const D = 240;
const P = 96;

interface AccountUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export default function AccountClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [avatar, setAvatar] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  /* --- picture adjust editor state --- */
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [editorErr, setEditorErr] = useState("");
  const [savingPic, setSavingPic] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; dx: number; dy: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account")
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          user?: AccountUser;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.user) {
          setLoadError(data.error || "Could not load your account.");
          setLoading(false);
          return;
        }
        setName(data.user.name);
        setEmail(data.user.email);
        setRole(data.user.role);
        setAvatar(data.user.avatar || "");
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Network error. Please try again.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function baseScale(): number {
    if (!dims) return 1;
    return Math.max(S / dims.w, S / dims.h);
  }

  function clampOff(o: { x: number; y: number }, z = zoom): {
    x: number;
    y: number;
  } {
    if (!dims) return o;
    const dispW = dims.w * baseScale() * z;
    const dispH = dims.h * baseScale() * z;
    const mx = Math.max(0, (dispW - D) / 2);
    const my = Math.max(0, (dispH - D) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, o.x)),
      y: Math.min(my, Math.max(-my, o.y)),
    };
  }

  function closeEditor() {
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setEditorSrc(null);
    setDims(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setEditorErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditorErr("");
    if (!f.type.startsWith("image/")) {
      setEditorErr("Please choose an image file.");
      return;
    }
    if (editorSrc) URL.revokeObjectURL(editorSrc);
    setDims(null);
    setZoom(1);
    setOff({ x: 0, y: 0 });
    setEditorSrc(URL.createObjectURL(f));
  }

  /* Drag-to-reposition */
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { sx: e.clientX, sy: e.clientY, dx: off.x, dy: off.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    setOff(clampOff({ x: d.dx + e.clientX - d.sx, y: d.dy + e.clientY - d.sy }));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function exportAvatar(): string | null {
    const img = imgRef.current;
    if (!img || !dims) return null;
    const bs = baseScale();
    const cropLeft = (S - D) / 2;
    const imgLeft = (S - dims.w * bs * zoom) / 2 + off.x;
    const imgTop = (S - dims.h * bs * zoom) / 2 + off.y;
    const sx = (cropLeft - imgLeft) / (bs * zoom);
    const sy = (cropLeft - imgTop) / (bs * zoom);
    const sw = D / (bs * zoom);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, 256, 256);
    let q = 0.88;
    let url = canvas.toDataURL("image/jpeg", q);
    while (url.length > 450_000 && q > 0.4) {
      q -= 0.1;
      url = canvas.toDataURL("image/jpeg", q);
    }
    return url;
  }

  async function savePicture() {
    setEditorErr("");
    const url = exportAvatar();
    if (!url) {
      setEditorErr("Could not read the image. Try a different file.");
      return;
    }
    setSavingPic(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: url }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEditorErr(data.error || "Could not save the picture.");
        setSavingPic(false);
        return;
      }
      setAvatar(url);
      setProfileMsg("Profile picture updated.");
      setProfileErr("");
      closeEditor();
      router.refresh();
    } catch {
      setEditorErr("Network error. Please try again.");
    }
    setSavingPic(false);
  }

  async function removePicture() {
    setProfileMsg("");
    setProfileErr("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setProfileErr(data.error || "Could not remove the picture.");
        return;
      }
      setAvatar("");
      setProfileMsg("Profile picture removed.");
      router.refresh();
    } catch {
      setProfileErr("Network error. Please try again.");
    }
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    const trimmed = name.trim();
    if (!trimmed) {
      setProfileErr("Display name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setProfileErr(data.error || "Could not save your profile.");
        setSavingProfile(false);
        return;
      }
      setName(trimmed);
      setProfileMsg("Profile saved.");
      router.refresh();
    } catch {
      setProfileErr("Network error. Please try again.");
    }
    setSavingProfile(false);
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (!currentPw) {
      setPwErr("Enter your current password.");
      return;
    }
    if (newPw.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr("New passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: currentPw, password: newPw }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPwErr(data.error || "Could not change your password.");
        setSavingPw(false);
        return;
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg("Password changed.");
    } catch {
      setPwErr("Network error. Please try again.");
    }
    setSavingPw(false);
  }

  if (loading) {
    return (
      <div className="card">
        <p className="sub">Loading your account…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card">
        <div className="alert alert-error">{loadError}</div>
      </div>
    );
  }

  /* Editor render math */
  const bs = baseScale();
  const dispW = dims ? dims.w * bs * zoom : 0;
  const dispH = dims ? dims.h * bs * zoom : 0;
  const imgLeft = (S - dispW) / 2 + off.x;
  const imgTop = (S - dispH) / 2 + off.y;
  const cropLeft = (S - D) / 2;
  const k = P / D; // preview scale
  const pvLeft = (imgLeft - cropLeft) * k;
  const pvTop = (imgTop - cropLeft) * k;

  return (
    <>
      {/* ---------- Profile ---------- */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Profile</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            margin: "12px 0 16px",
          }}
        >
          <Avatar name={name} avatar={avatar} size={64} />
          <div>
            <div style={{ fontWeight: 700 }}>{name}</div>
            <div className="sub">
              {email} · {role.charAt(0).toUpperCase() + role.slice(1)}
            </div>
          </div>
        </div>

        {profileErr && <div className="alert alert-error">{profileErr}</div>}
        {profileMsg && <div className="alert alert-ok">{profileMsg}</div>}

        <form onSubmit={saveProfile}>
          <div className="form-group">
            <label htmlFor="acct-name">Display name</label>
            <input
              id="acct-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label>Profile picture</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => fileRef.current?.click()}
              >
                Choose picture…
              </button>
              {avatar && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={removePicture}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingProfile}
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>

      {/* ---------- Adjust picture ---------- */}
      {editorSrc && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Adjust picture</h3>
          <p className="sub" style={{ marginTop: 0 }}>
            Drag to reposition, zoom with the slider — the circle shows exactly
            what will be saved.
          </p>
          {editorErr && <div className="alert alert-error">{editorErr}</div>}

          <div className="editor-grid">
            <div
              style={{
                position: "relative",
                width: S,
                height: S,
                background: "#0f1420",
                borderRadius: 12,
                overflow: "hidden",
                touchAction: "none",
                cursor: "grab",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                ref={imgRef}
                src={editorSrc}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setDims({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                style={{
                  position: "absolute",
                  left: imgLeft,
                  top: imgTop,
                  width: dispW,
                  height: dispH,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              {/* dimmed overlay with a clean circular cutout */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.55)",
                  WebkitMaskImage: `radial-gradient(circle ${D / 2}px at 50% 50%, transparent ${D / 2 - 1}px, black ${D / 2 + 1}px)`,
                  maskImage: `radial-gradient(circle ${D / 2}px at 50% 50%, transparent ${D / 2 - 1}px, black ${D / 2 + 1}px)`,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: cropLeft,
                  top: cropLeft,
                  width: D,
                  height: D,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.9)",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            </div>

            <div>
              <div className="form-group">
                <label htmlFor="acct-zoom">Zoom</label>
                <input
                  id="acct-zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    setZoom(z);
                    setOff((o) => clampOff(o, z));
                  }}
                  className="input"
                  style={{ padding: 0 }}
                />
              </div>
              <div className="form-group">
                <label>Preview</label>
                <div
                  style={{
                    width: P,
                    height: P,
                    borderRadius: "50%",
                    overflow: "hidden",
                    position: "relative",
                    background: "#e5e7eb",
                  }}
                >
                  <img
                    src={editorSrc}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: pvLeft,
                      top: pvTop,
                      width: dispW * k,
                      height: dispH * k,
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={savePicture}
                  disabled={savingPic || !dims}
                >
                  {savingPic ? "Saving…" : "Save picture"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={closeEditor}
                  disabled={savingPic}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Password ---------- */}
      <div className="card">
        <h3>Password</h3>
        {pwErr && <div className="alert alert-error">{pwErr}</div>}
        {pwMsg && <div className="alert alert-ok">{pwMsg}</div>}
        <form onSubmit={changePassword}>
          <div className="form-group">
            <label htmlFor="acct-current">Current password</label>
            <input
              id="acct-current"
              type="password"
              className="input"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="acct-new">New password</label>
              <input
                id="acct-new"
                type="password"
                className="input"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="acct-confirm">Confirm new password</label>
              <input
                id="acct-confirm"
                type="password"
                className="input"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPw}
          >
            {savingPw ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>
    </>
  );
}
