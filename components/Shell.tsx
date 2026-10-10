import type { SessionUser } from "../lib/auth";
import type { AgencySettings } from "../lib/settings";
import { visibleClientIds } from "../lib/auth";
import { unreadAlertCount } from "../lib/alerts";
import LogoutButton from "./LogoutButton";
import Avatar from "./Avatar";
import NavToggle from "./NavToggle";
import NavLinks, { type NavLinkItem } from "./NavLinks";

const NAV: Array<{ href: string; label: string; roles: string[]; badge?: "alerts" }> = [
  { href: "/", label: "Overview", roles: ["owner", "manager"] },
  { href: "/clients", label: "Clients", roles: ["owner", "manager"] },
  { href: "/alerts", label: "Alerts", roles: ["owner", "manager"], badge: "alerts" },
  { href: "/reports", label: "Reports", roles: ["owner", "manager"] },
  { href: "/invoices", label: "Invoices", roles: ["owner", "manager"] },
  { href: "/delivery", label: "Delivery", roles: ["owner", "manager"] },
  { href: "/team", label: "Team", roles: ["owner"] },
  { href: "/settings", label: "Settings", roles: ["owner"] },
  { href: "/account", label: "My account", roles: ["owner", "manager", "client"] },
];

export default async function Shell({
  user,
  settings,
  children,
}: {
  user: SessionUser;
  settings: AgencySettings;
  children: React.ReactNode;
}) {
  const links: NavLinkItem[] =
    user.role === "client"
      ? [
          { href: `/clients/${user.client_id}`, label: "My Dashboard" },
          { href: "/account", label: "My account" },
        ]
      : NAV.filter((n) => n.roles.includes(user.role)).map((n) => ({
          href: n.href,
          label: n.label,
          badge: n.badge,
        }));
  const initial = settings.agency_name.trim().charAt(0).toUpperCase() || "R";
  const unread =
    user.role === "owner" || user.role === "manager"
      ? unreadAlertCount(visibleClientIds(user))
      : 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          {settings.logo_data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_data} alt="" className="brand-logo" />
          ) : (
            <span className="brand-mark">{initial}</span>
          )}
          <span>{settings.agency_name}</span>
        </div>
        <NavLinks links={links} alertsUnread={unread} />
        <div className="sidebar-foot">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={user.name} avatar={user.avatar} size={32} />
            <div>
              Signed in as <strong style={{ color: "var(--text)" }}>{user.name}</strong>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <NavToggle />
          <div className="spacer" />
          <span className="userchip">
            <Avatar name={user.name} avatar={user.avatar} size={24} />
            <strong>{user.name}</strong> · {user.role}
          </span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
