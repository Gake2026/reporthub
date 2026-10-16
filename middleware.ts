import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);
// Public marketing assets (walkthrough video, screenshots) linked from
// outreach emails — must stay reachable without a session.
const PUBLIC_PREFIXES = ["/assets/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("rh_session")?.value;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // NOTE: no bounce for token + /login here. A stale cookie (e.g. session
  // wiped by a redeploy on hosts without persistent disks) would ping-pong
  // /login -> / -> /login forever (ERR_TOO_MANY_REDIRECTS). The login page
  // itself validates the session server-side and redirects valid users to /.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
