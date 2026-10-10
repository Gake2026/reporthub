import { NextResponse } from "next/server";
import { getSession, type Role, type SessionUser } from "./auth";

export const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/**
 * Resolve the session or return an error response.
 * Pass allowed roles to additionally gate (e.g. ["owner"]).
 */
export async function needUser(
  allowed?: Role[]
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!user || (allowed && !allowed.includes(user.role)))
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return { user };
}
