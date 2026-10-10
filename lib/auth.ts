import { cookies } from "next/headers";
import db from "./db";
import { verifyPassword } from "./password";

export type Role = "owner" | "manager" | "client";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  client_id: number | null;
  avatar: string;
}

interface SessionRow {
  token: string;
  expires_at: string;
  id: number;
  name: string;
  email: string;
  role: Role;
  client_id: number | null;
  avatar: string;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_NAME = "rh_session";

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.token, s.expires_at, u.id, u.name, u.email, u.role, u.client_id, u.avatar
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND u.active = 1`
    )
    .get(token) as SessionRow | undefined;
  if (!row) return null;
  if (Number.isNaN(Date.parse(row.expires_at)) || Date.parse(row.expires_at) < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    client_id: row.client_id,
    avatar: row.avatar ?? "",
  };
}

export function createSession(userId: number): string {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);
  return token;
}

export function destroySession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userCount(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
}

export function verifyLogin(
  email: string,
  password: string
): { id: number } | null {
  const row = db
    .prepare("SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(?) AND active = 1")
    .get(email.trim()) as { id: number; password_hash: string } | undefined;
  if (!row) return null;
  return verifyPassword(password, row.password_hash) ? { id: row.id } : null;
}

/**
 * Which client ids this user may see.
 * owner → every client; manager → assigned clients; client → their own client.
 */
export function visibleClientIds(user: SessionUser): number[] | "all" {
  if (user.role === "owner") return "all";
  if (user.role === "manager") {
    return (
      db.prepare("SELECT id FROM clients WHERE manager_id = ?").all(user.id) as Array<{
        id: number;
      }>
    ).map((r) => r.id);
  }
  return user.client_id ? [user.client_id] : [];
}

export function canSeeClient(user: SessionUser, clientId: number): boolean {
  const v = visibleClientIds(user);
  return v === "all" || v.includes(clientId);
}

/** Managers may edit clients assigned to them; owners may edit anything. */
export function canEditClient(user: SessionUser, clientId: number): boolean {
  if (user.role === "owner") return true;
  if (user.role !== "manager") return false;
  return canSeeClient(user, clientId);
}
