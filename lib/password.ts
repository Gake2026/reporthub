// Password hashing: PBKDF2-SHA-256, 120,000 iterations, 16-byte salt.
// Stored format: `pbkdf2$<iterations>$<salt hex>$<hash hex>`.
import crypto from "node:crypto";

export const PBKDF2_ITERATIONS = 120_000;

export function hashPasswordSync(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(pw, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString("hex")}$${hash.toString(
    "hex"
  )}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  const hash = crypto.pbkdf2Sync(pw, salt, iterations, expected.length, "sha256");
  return (
    hash.length === expected.length && crypto.timingSafeEqual(hash, expected)
  );
}
