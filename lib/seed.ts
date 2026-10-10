// Demo dataset: one demo agency, three demo logins, four demo clients with
// six months of realistic daily marketing metrics. Deterministic output so
// every fresh install looks the same. The buyer wipes this from Settings
// ("Remove all client data") before going live.

import { hashPasswordSync } from "./password";
import db from "./db";

// Deterministic PRNG so seeded demo datasets are reproducible.
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_SETTINGS: Array<[string, string]> = [
  ["agency_name", "Demo Agency"],
  ["primary_color", "#4f46e5"],
  ["accent_color", "#0ea5e9"],
  ["support_email", "hello@demoagency.example"],
  ["logo_data", ""],
];

interface DemoClient {
  name: string;
  website: string;
  status: "active" | "paused" | "churned";
  retainer: number;
  notes: string;
  dailySpend: [number, number]; // min/max base daily spend
  channels: string[];
  convRate: [number, number]; // conversions per click range
  revPerConv: [number, number];
}

const DEMO_CLIENTS: DemoClient[] = [
  {
    name: "Northwind Outdoors",
    website: "northwindoutdoors.example",
    status: "active",
    retainer: 4500,
    notes: "DTC outdoor gear. Q4 push on Google + Meta.",
    dailySpend: [180, 320],
    channels: ["Google Ads", "Meta Ads", "TikTok Ads", "Email"],
    convRate: [0.02, 0.05],
    revPerConv: [85, 140],
  },
  {
    name: "BrightSmile Dental",
    website: "brightsmiledental.example",
    status: "active",
    retainer: 2800,
    notes: "Local dental practice. Lead-gen focused.",
    dailySpend: [60, 120],
    channels: ["Google Ads", "Meta Ads"],
    convRate: [0.04, 0.09],
    revPerConv: [220, 380],
  },
  {
    name: "Summit Legal Group",
    website: "summitlegal.example",
    status: "active",
    retainer: 6000,
    notes: "Personal injury. High CPC, high case value.",
    dailySpend: [250, 480],
    channels: ["Google Ads", "Meta Ads", "Display"],
    convRate: [0.015, 0.04],
    revPerConv: [900, 2400],
  },
  {
    name: "PeakFit Gyms",
    website: "peakfitgyms.example",
    status: "paused",
    retainer: 0,
    notes: "Paused for summer. Trial membership campaign earlier this year.",
    dailySpend: [40, 90],
    channels: ["Meta Ads", "TikTok Ads"],
    convRate: [0.03, 0.07],
    revPerConv: [45, 90],
  },
];

export function seedDemo(): void {
  const rand = mulberry32(20261009);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const clientIds: number[] = [];
  const seedTx = db.transaction(() => {
    // ---- White-label settings ----
    const insSetting = db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
    );
    for (const [k, v] of DEMO_SETTINGS) insSetting.run(k, v);

    // ---- Demo users ----
    const insUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, client_id)
       VALUES (?, ?, ?, ?, ?)`
    );
    const pw = hashPasswordSync("demo1234");
    const ownerId = Number(
      insUser.run("Dana Owner", "owner@demo.agency", pw, "owner", null)
        .lastInsertRowid
    );
    const managerId = Number(
      insUser.run("Morgan Manager", "manager@demo.agency", pw, "manager", null)
        .lastInsertRowid
    );

    // ---- Demo clients ----
    const insClient = db.prepare(
      `INSERT INTO clients (name, website, status, retainer, manager_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insContact = db.prepare(
      `INSERT INTO client_contacts (client_id, name, email, role)
       VALUES (?, ?, ?, ?)`
    );
    const insMetric = db.prepare(
      `INSERT INTO metrics (client_id, date, channel, campaign, impressions, clicks, spend, conversions, revenue, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')`
    );

    DEMO_CLIENTS.forEach((c, ci) => {
      const res = insClient.run(
        c.name,
        c.website,
        c.status,
        c.retainer,
        ci < 3 ? managerId : null,
        c.notes
      );
      const clientId = Number(res.lastInsertRowid);
      clientIds.push(clientId);
      insContact.run(
        clientId,
        `${c.name.split(" ")[0]} Contact`,
        `marketing@${c.website}`,
        "Marketing lead"
      );

      // Six months of daily metrics, ending yesterday (so "last 30 days"
      // always has data on a fresh install).
      const end = new Date();
      end.setDate(end.getDate() - 1);
      for (let back = 180; back >= 0; back--) {
        const d = new Date(end);
        d.setDate(d.getDate() - back);
        const date = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        const weekendDip = dow === 0 || dow === 6 ? 0.7 : 1;
        // Paused client: no data in the most recent 45 days.
        if (c.status === "paused" && back < 45) continue;
        const growth = 1 + (180 - back) / 180 * 0.35; // gentle upward trend
        for (const ch of c.channels) {
          if (rand() < 0.06) continue; // occasional missing channel-day
          const spend = round2(
            between(c.dailySpend[0], c.dailySpend[1]) * weekendDip * growth * between(0.8, 1.2)
          );
          const cpc = between(0.6, 2.4);
          const clicks = Math.max(1, Math.round(spend / cpc));
          const impressions = Math.round(clicks * between(28, 60));
          const convRate = between(c.convRate[0], c.convRate[1]);
          const conversions = Math.round(clicks * convRate * between(0.7, 1.3));
          const revenue = round2(conversions * between(c.revPerConv[0], c.revPerConv[1]));
          insMetric.run(
            clientId,
            date,
            ch,
            back % 3 === 0 ? "Evergreen" : "Seasonal Push",
            impressions,
            clicks,
            spend,
            conversions,
            revenue
          );
        }
      }
      void ownerId;
    });

    // ---- Demo client login (sees only Northwind Outdoors) ----
    insUser.run(
      "Casey Client",
      "client@demo.agency",
      pw,
      "client",
      clientIds[0]
    );
  });

  seedTx();
  seedFeatureExtras(clientIds);
}

/**
 * Demo data for the newer workspaces (alerts, budgets, invoices, platform
 * connections, schedules). Alert values are computed from the seeded metrics
 * so the demo feed shows real numbers.
 */
function seedFeatureExtras(clientIds: number[]): void {
  const shiftDays = (d: string, n: number): string => {
    const dt = new Date(d + "T12:00:00");
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const today = new Date().toISOString().slice(0, 10);
  const to = shiftDays(today, -1);
  const from = shiftDays(to, -29);
  const prevTo = shiftDays(from, -1);
  const prevFrom = shiftDays(from, -30);

  const tx = db.transaction(() => {
    // ---- Alerts: real 30d-vs-prior numbers for the biggest spend swing ----
    let best: { id: number; pct: number; cur: number; prev: number } | null = null;
    for (const id of clientIds.slice(0, 3)) {
      const cur = (db.prepare(
        "SELECT COALESCE(SUM(spend),0) AS s FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?"
      ).get(id, from, to) as { s: number }).s;
      const prev = (db.prepare(
        "SELECT COALESCE(SUM(spend),0) AS s FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?"
      ).get(id, prevFrom, prevTo) as { s: number }).s;
      if (prev > 0) {
        const p = ((cur - prev) / prev) * 100;
        if (!best || Math.abs(p) > Math.abs(best.pct)) best = { id, pct: p, cur, prev };
      }
    }
    const insAlert = db.prepare(
      `INSERT INTO alerts (client_id, metric, direction, message, severity,
        period_from, period_to, prev_from, prev_to, current_value, previous_value, change_pct)
       VALUES (?, 'spend', ?, ?, 'warning', ?, ?, ?, ?, ?, ?, ?)`
    );
    if (best) {
      const dir = best.pct >= 0 ? "up" : "down";
      const verb = best.pct >= 0 ? "rose" : "fell";
      insAlert.run(
        best.id, dir,
        `Ad spend ${verb} ${Math.abs(best.pct).toFixed(1)}% vs the prior 30 days.`,
        from, to, prevFrom, prevTo,
        Math.round(best.cur * 100) / 100, Math.round(best.prev * 100) / 100,
        Math.round(best.pct * 10) / 10
      );
    }
    // Second demo alert: CPA movement on another client.
    const otherId = clientIds.slice(0, 3).find((id) => !best || id !== best.id);
    if (otherId) {
      const agg = (f: string, t: string) => db.prepare(
        `SELECT COALESCE(SUM(spend),0) AS s, COALESCE(SUM(conversions),0) AS c
         FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?`
      ).get(otherId, f, t) as { s: number; c: number };
      const a = agg(from, to), b = agg(prevFrom, prevTo);
      const cpaA = a.c > 0 ? a.s / a.c : 0, cpaB = b.c > 0 ? b.s / b.c : 0;
      if (cpaB > 0 && cpaA > 0) {
        const p = ((cpaA - cpaB) / cpaB) * 100;
        const dir = p >= 0 ? "up" : "down";
        const verb = p >= 0 ? "rose" : "fell";
        db.prepare(
          `INSERT INTO alerts (client_id, metric, direction, message, severity,
            period_from, period_to, prev_from, prev_to, current_value, previous_value, change_pct)
           VALUES (?, 'cpa', ?, ?, 'info', ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          otherId, dir,
          `Cost per acquisition ${verb} ${Math.abs(p).toFixed(1)}% vs the prior 30 days.`,
          from, to, prevFrom, prevTo,
          Math.round(cpaA * 100) / 100, Math.round(cpaB * 100) / 100,
          Math.round(p * 10) / 10
        );
      }
    }

    // ---- Budgets: current-month budgets for the active demo clients ----
    const month = today.slice(0, 7);
    const insBudget = db.prepare(
      `INSERT OR IGNORE INTO budgets (client_id, channel, month, amount) VALUES (?, '', ?, ?)`
    );
    const budgets: Array<[number, number]> = [
      [clientIds[0], 40000], // Northwind: on-track
      [clientIds[1], 4500], // BrightSmile: over pace (demos the off-track state)
      [clientIds[2], 33000], // Summit: on-track
    ];
    for (const [id, amt] of budgets) insBudget.run(id, month, amt);

    // ---- Platform connections: mapped but disconnected (honest demo state) ----
    const insConn = db.prepare(
      `INSERT OR IGNORE INTO platform_connections (client_id, platform, account_name, status)
       VALUES (?, ?, ?, 'disconnected')`
    );
    for (const id of clientIds.slice(0, 3)) {
      insConn.run(id, "google_ads", "Demo ad account");
      insConn.run(id, "meta_ads", "Demo ad account");
    }

    // ---- Sample invoice for the first client ----
    const invRes = db.prepare(
      `INSERT INTO invoices (number, client_id, issue_date, due_date, notes, tax_rate, status)
       VALUES ('INV-0001', ?, ?, ?, 'Monthly retainer — thank you for your business.', 0, 'unpaid')`
    ).run(clientIds[0], shiftDays(today, -6), shiftDays(today, 24));
    const invId = Number(invRes.lastInsertRowid);
    const insItem = db.prepare(
      `INSERT INTO invoice_items (invoice_id, description, qty, rate, position)
       VALUES (?, ?, ?, ?, ?)`
    );
    insItem.run(invId, "Monthly retainer — reporting & analytics", 1, 4500, 0);
    insItem.run(invId, "Ad creative refresh (4 assets)", 4, 150, 1);

    // ---- Scheduled delivery for the first client ----
    db.prepare(
      `INSERT INTO report_schedules (client_id, frequency, recipients, active)
       VALUES (?, 'monthly', 'marketing@northwindoutdoors.example', 1)`
    ).run(clientIds[0]);
  });
  tx();
}

/** Remove all business + demo data. keepUsers=false also wipes users/sessions. */
export function wipeAll(keepUsers: boolean): void {
  const tx = db.transaction(() => {
    db.exec("DELETE FROM email_log");
    db.exec("DELETE FROM report_schedules");
    db.exec("DELETE FROM budgets");
    db.exec("DELETE FROM platform_connections");
    db.exec("DELETE FROM invoice_items");
    db.exec("DELETE FROM invoices");
    db.exec("DELETE FROM reports");
    db.exec("DELETE FROM alert_thresholds");
    db.exec("DELETE FROM alerts");
    db.exec("DELETE FROM metrics");
    db.exec("DELETE FROM client_contacts");
    db.exec("DELETE FROM clients");
    if (!keepUsers) {
      db.exec("DELETE FROM sessions");
      db.exec("DELETE FROM users");
      db.exec("DELETE FROM settings");
    }
  });
  tx();
}
