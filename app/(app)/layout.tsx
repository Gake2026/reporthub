export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, COOKIE_NAME } from "../../lib/auth";
import { getSettings } from "../../lib/settings";
import Shell from "../../components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) {
    // Kill stale session cookies (e.g. wiped by a redeploy on hosts without
    // persistent disks). Otherwise middleware bounces /login -> / forever:
    // ERR_TOO_MANY_REDIRECTS.
    const store = await cookies();
    store.delete(COOKIE_NAME);
    redirect("/login");
  }
  const settings = getSettings();
  return (
    <div
      style={
        {
          "--brand": settings.primary_color,
          "--accent": settings.accent_color,
        } as React.CSSProperties
      }
    >
      <Shell user={user} settings={settings}>
        {children}
      </Shell>
    </div>
  );
}
