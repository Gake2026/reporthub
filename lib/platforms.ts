// Platform connection framework: per-client account mapping for the five
// major ad platforms, with connection states, last-sync tracking, and a
// secure credential slot per client/platform.
//
// HONEST LIMIT: live provider imports stay INACTIVE until the deploying team
// installs real OAuth credentials and provider adapters. This module stores
// the mapping and credentials; sync() records the attempt and reports what
// is missing. The settings copy and README say this plainly.

import db from "./db";

export interface PlatformDef {
  id: string;
  label: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "google_ads", label: "Google Ads" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "ga4", label: "Google Analytics 4" },
  { id: "linkedin_ads", label: "LinkedIn Ads" },
  { id: "tiktok_ads", label: "TikTok Ads" },
];

export interface PlatformConnection {
  id: number;
  client_id: number;
  platform: string;
  platform_label: string;
  account_name: string;
  status: "disconnected" | "connected" | "error";
  has_credentials: boolean;
  last_sync_at: string | null;
  last_error: string;
}

export function isKnownPlatform(p: string): boolean {
  return PLATFORMS.some((d) => d.id === p);
}

export function getConnections(clientId: number): PlatformConnection[] {
  const rows = db
    .prepare("SELECT * FROM platform_connections WHERE client_id = ?")
    .all(clientId) as Array<{
    id: number;
    client_id: number;
    platform: string;
    account_name: string;
    status: string;
    credentials: string;
    last_sync_at: string | null;
    last_error: string;
  }>;
  const byId = new Map(rows.map((r) => [r.platform, r]));
  return PLATFORMS.map((p) => {
    const r = byId.get(p.id);
    return {
      id: r?.id ?? 0,
      client_id: clientId,
      platform: p.id,
      platform_label: p.label,
      account_name: r?.account_name ?? "",
      status: (r?.status ?? "disconnected") as PlatformConnection["status"],
      has_credentials: Boolean(r?.credentials),
      last_sync_at: r?.last_sync_at ?? null,
      last_error: r?.last_error ?? "",
    };
  });
}

/** Store or update the account mapping + credentials for one platform. */
export function upsertConnection(
  clientId: number,
  platform: string,
  accountName: string,
  credentials: string
): void {
  if (!isKnownPlatform(platform)) throw new Error("Unknown platform.");
  const hasCreds = Boolean(credentials && credentials.trim());
  db.prepare(
    `INSERT INTO platform_connections (client_id, platform, account_name, status, credentials, last_error)
     VALUES (?, ?, ?, ?, ?, '')
     ON CONFLICT(client_id, platform) DO UPDATE SET
       account_name = excluded.account_name,
       credentials = excluded.credentials,
       status = excluded.status,
       last_error = ''
    `
  ).run(
    clientId,
    platform,
    (accountName ?? "").trim().slice(0, 200),
    hasCreds ? "connected" : "disconnected",
    hasCreds ? credentials.trim().slice(0, 4000) : ""
  );
}

export function disconnectPlatform(clientId: number, platform: string): void {
  if (!isKnownPlatform(platform)) throw new Error("Unknown platform.");
  db.prepare(
    `INSERT INTO platform_connections (client_id, platform, status, credentials, last_error)
     VALUES (?, ?, 'disconnected', '', '')
     ON CONFLICT(client_id, platform) DO UPDATE SET
       status = 'disconnected', credentials = '', last_error = '', last_sync_at = NULL`
  ).run(clientId, platform);
}

export interface SyncResult {
  ok: boolean;
  message: string;
  synced_at: string | null;
}

/**
 * Attempt a sync for one platform. Without real provider credentials and
 * adapters this records the attempt honestly instead of pretending.
 */
export function syncPlatform(clientId: number, platform: string): SyncResult {
  if (!isKnownPlatform(platform)) throw new Error("Unknown platform.");
  const row = db
    .prepare(
      "SELECT credentials FROM platform_connections WHERE client_id = ? AND platform = ?"
    )
    .get(clientId, platform) as { credentials: string } | undefined;
  const now = new Date().toISOString();
  if (!row?.credentials) {
    db.prepare(
      `INSERT INTO platform_connections (client_id, platform, status, last_error)
       VALUES (?, ?, 'error', ?)
       ON CONFLICT(client_id, platform) DO UPDATE SET status = 'error', last_error = excluded.last_error`
    ).run(
      clientId,
      platform,
      "No credentials configured — add this platform's API credentials to enable live sync."
    );
    return {
      ok: false,
      message:
        "Live import is not active: no provider credentials are configured for this platform. Add them here and your tech team enables the provider adapter at deploy time.",
      synced_at: null,
    };
  }
  // Credentials exist but no provider adapter is installed in this build.
  db.prepare(
    `UPDATE platform_connections SET last_sync_at = ?, status = 'error',
       last_error = 'Provider adapter not installed — your tech team enables live imports at deploy time.'
     WHERE client_id = ? AND platform = ?`
  ).run(now, clientId, platform);
  return {
    ok: false,
    message:
      "Credentials saved, but live import needs the provider adapter installed by your tech team at deploy time. CSV import and manual entry work today.",
    synced_at: now,
  };
}

export function syncAllPlatforms(clientId: number): SyncResult[] {
  return PLATFORMS.map((p) => syncPlatform(clientId, p.id));
}
