export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth";
import { getSettings } from "../../lib/settings";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  // Already signed in with a live session? Skip the form. A stale cookie
  // (session wiped server-side) simply renders the form — no redirect loop.
  const session = await getSession();
  if (session) redirect("/");
  const settings = getSettings();
  const initial = settings.agency_name.trim().charAt(0).toUpperCase() || "R";
  return (
    <div
      className="login-wrap"
      style={
        {
          "--brand": settings.primary_color,
          "--accent": settings.accent_color,
        } as React.CSSProperties
      }
    >
      <div className="card login-card">
        <div className="brand">
          {settings.logo_data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_data} alt="" className="brand-logo" />
          ) : (
            <span className="brand-mark">{initial}</span>
          )}
          <span>{settings.agency_name}</span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", margin: "0 0 18px" }}>
          Sign in to your reporting dashboard
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
