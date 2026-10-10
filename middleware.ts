import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("rh_session")?.value;

  if (!token && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
