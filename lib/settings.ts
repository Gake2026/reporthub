import db from "./db";

export interface AgencySettings {
  agency_name: string;
  primary_color: string;
  accent_color: string;
  support_email: string;
  logo_data: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
}

const DEFAULTS: AgencySettings = {
  agency_name: "ReportHub",
  primary_color: "#4f46e5",
  accent_color: "#0ea5e9",
  support_email: "",
  logo_data: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
};

export function getSettings(): AgencySettings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const out = { ...DEFAULTS };
  for (const r of rows) {
    if (r.key in out) (out as Record<string, string>)[r.key] = r.value;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(out.primary_color))
    out.primary_color = DEFAULTS.primary_color;
  if (!/^#[0-9a-fA-F]{6}$/.test(out.accent_color))
    out.accent_color = DEFAULTS.accent_color;
  return out;
}

const ALLOWED = new Set(Object.keys(DEFAULTS));

export function updateSettings(patch: Record<string, string>): AgencySettings {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (!ALLOWED.has(k)) continue;
      if (k === "logo_data" && v && v.length > 500_000)
        throw new Error("Logo image is too large (max ~350KB).");
      stmt.run(k, v ?? "");
    }
  });
  tx();
  return getSettings();
}
