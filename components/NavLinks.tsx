"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavLinkItem {
  href: string;
  label: string;
  badge?: "alerts";
}

/**
 * Client-side nav links. Active state uses usePathname() so the highlight
 * follows client-side navigation. (Reading the pathname from request headers
 * in the server layout goes stale because layouts don't re-render on
 * client-side navigation.)
 */
export default function NavLinks({
  links,
  alertsUnread,
}: {
  links: NavLinkItem[];
  alertsUnread: number;
}) {
  const pathname = usePathname() || "/";
  return (
    <>
      {links.map((l) => {
        const active =
          pathname === l.href ||
          (l.href !== "/" && pathname.startsWith(l.href + "/"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={"navlink" + (active ? " active" : "")}
          >
            <span className="dot" />
            {l.label}
            {l.badge === "alerts" && alertsUnread > 0 && (
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
                {alertsUnread}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
