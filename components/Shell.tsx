import Link from "next/link";
import { headers } from "next/headers";
import type { SessionUser } from "../lib/auth";
import type { AgencySettings } from "../lib/settings";
import { visibleClientIds } from "../lib/auth";
import { unreadAlertCount } from "../lib/alerts";
import LogoutButton from "./LogoutButton";
import Avatar from "./Avatar";

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
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";
  const links =
    user.role === "client"
      ? [
          { href: `/clients/${user.client_id}`, label: "My Dashboard", roles: ["client"] },
          { href: "/account", label: "My account", roles: ["client"] },
        ]
      : NAV.filter((n) => n.roles.includes(user.role));
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={
              "navlink" +
              (pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))
                ? " active"
                : "")
            }
          >
            <span className="dot" />
            {l.label}
            {"badge" in l && l.badge === "alerts" && unread > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "var(--red, #dc2626)",
                  color: "#fff",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 8px",
                }}
              >
                {unread}
              </span>
            )}
          </Link>
        ))}
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
