import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyLogin, createSession, COOKIE_NAME } from "../../../../lib/auth";
import { bad } from "../../../../lib/api";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!body.email || !body.password)
    return bad("Email and password are required.");
  const found = verifyLogin(body.email, body.password);
  if (!found) return bad("Invalid email or password.", 401);
  const token = createSession(found.id);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
    secure: process.env.COOKIE_SECURE === "true",
  });
  return NextResponse.json({ ok: true });
}
