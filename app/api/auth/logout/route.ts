import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, COOKIE_NAME } from "../../../../lib/auth";

export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) destroySession(token);
  store.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
