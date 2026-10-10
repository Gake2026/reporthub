import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import { getSettings } from "../../../lib/settings";
import BrandingForm from "./BrandingForm";
import SmtpForm from "./SmtpForm";
import DangerZone from "./DangerZone";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/");

  const settings = getSettings();

  return (
    <>
      <div className="pagehead">
        <h1>Settings</h1>
        <span className="sub">White-label branding and data management</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Agency branding</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Everything here appears on client dashboards, reports, and the login
          screen — your clients see your brand, never ours.
        </p>
        <BrandingForm initial={settings} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Email delivery</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Scheduled report emails send through your own mail server. Until these
          are configured, deliveries are logged but not sent.
        </p>
        <SmtpForm
          initial={{
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port,
            smtp_user: settings.smtp_user,
            smtp_pass: settings.smtp_pass,
            smtp_from: settings.smtp_from,
          }}
        />
      </div>

      <DangerZone />
    </>
  );
}
