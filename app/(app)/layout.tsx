export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/auth";
import { getSettings } from "../../lib/settings";
import Shell from "../../components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
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
