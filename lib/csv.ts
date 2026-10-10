// CSV import engine for client marketing metrics: header auto-detection
// (header aliases + sample-value sniffing), mapping confirmation, and
// validated row import. Re-importing the same dates replaces that day's
// previously imported rows for the same channel/campaign, so uploads are
// safe to repeat.

import db from "./db";

export const MAX_ROWS = 5000;
export const BATCH_SIZE = 200;
export const MAX_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/** Parse CSV into rows, honoring quoted fields and escaped quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore CR; LF handling above closes the row
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Split parsed CSV into header + non-empty data rows. */
export function splitRows(parsed: string[][]): {
  headers: string[];
  rows: string[][];
} {
  const headers = parsed[0] ?? [];
  const rows = parsed
    .slice(1)
    .filter((r) => r.some((cell) => (cell ?? "").trim() !== ""));
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Field definitions (aliases are normalized: lowercase, alphanumerics only)
// ---------------------------------------------------------------------------

export interface FieldSpec {
  field: string;
  label: string;
  required: boolean;
  aliases: string[];
}

export const FIELDS: FieldSpec[] = [
  {
    field: "date",
    label: "Date",
    required: true,
    aliases: ["date", "day", "reportdate", "transactiondate", "statdate"],
  },
  {
    field: "channel",
    label: "Channel",
    required: false,
    aliases: [
      "channel",
      "platform",
      "source",
      "medium",
      "trafficsource",
      "network",
      "adsource",
    ],
  },
  {
    field: "campaign",
    label: "Campaign",
    required: false,
    aliases: [
      "campaign",
      "campaignname",
      "adgroup",
      "adset",
      "adgroupname",
      "promotion",
    ],
  },
  {
    field: "impressions",
    label: "Impressions",
    required: false,
    aliases: ["impressions", "imps", "views", "reach"],
  },
  {
    field: "clicks",
    label: "Clicks",
    required: false,
    aliases: ["clicks", "clickcount", "linkclicks", "clicksall", "visits"],
  },
  {
    field: "spend",
    label: "Spend",
    required: false,
    aliases: [
      "spend",
      "cost",
      "adspend",
      "amount",
      "amountspent",
      "totalspend",
      "budget",
      "spent",
    ],
  },
  {
    field: "conversions",
    label: "Conversions",
    required: false,
    aliases: [
      "conversions",
      "conv",
      "leads",
      "purchases",
      "sales",
      "results",
      "actions",
      "goals",
    ],
  },
  {
    field: "revenue",
    label: "Revenue",
    required: false,
    aliases: [
      "revenue",
      "rev",
      "attributedrevenue",
      "purchasevalue",
      "conversionvalue",
      "totalvalue",
      "income",
    ],
  },
];

// ---------------------------------------------------------------------------
// Header auto-detection
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low" | "none";

export interface DetectedField {
  field: string;
  label: string;
  required: boolean;
  column: number | null;
  header: string | null;
  confidence: Confidence;
  sample: string;
}

const normHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_SLASH_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const INT_RE = /^-?\d+$/;
const KNOWN_CHANNELS = [
  "google ads",
  "google",
  "meta",
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "twitter",
  "x",
  "snapchat",
  "youtube",
  "email",
  "organic",
  "seo",
  "display",
  "pinterest",
  "reddit",
];

function samplePredicates(field: string): Array<(v: string) => boolean> {
  switch (field) {
    case "date":
      return [(v) => DATE_RE.test(v) || DATE_SLASH_RE.test(v)];
    case "impressions":
    case "clicks":
    case "conversions":
      return [(v) => INT_RE.test(v.replace(/[,\s]/g, ""))];
    case "spend":
    case "revenue":
      return [(v) => parseAmount(v) !== null];
    case "channel":
      return [(v) => KNOWN_CHANNELS.includes(v.trim().toLowerCase())];
    default:
      return [];
  }
}

/**
 * Detect column mappings using header aliases first, then sample-value
 * detection. Each CSV column is used at most once.
 */
export function detectMappings(
  headers: string[],
  rows: string[][]
): DetectedField[] {
  const used = new Set<number>();
  const nh = headers.map(normHeader);
  const sampleOf = (i: number): string => {
    for (const r of rows) {
      const v = (r[i] ?? "").trim();
      if (v) return v;
    }
    return "";
  };

  return FIELDS.map((spec) => {
    let column: number | null = null;
    let confidence: Confidence = "none";

    // 1) Exact alias match on the normalized header.
    for (const a of spec.aliases) {
      const i = nh.findIndex((h, idx) => !used.has(idx) && h === a);
      if (i >= 0) {
        column = i;
        confidence = "high";
        break;
      }
    }
    // 2) Substring match (both directions), longer aliases only.
    if (column === null) {
      for (const a of spec.aliases) {
        if (a.length < 4) continue;
        const i = nh.findIndex(
          (h, idx) => !used.has(idx) && (h.includes(a) || a.includes(h))
        );
        if (i >= 0) {
          column = i;
          confidence = "medium";
          break;
        }
      }
    }
    // 3) Sample-value detection: >=60% of non-empty cells match the kind.
    if (column === null) {
      const preds = samplePredicates(spec.field);
      if (preds.length > 0 && rows.length > 0) {
        const width = Math.max(...rows.map((r) => r.length), headers.length);
        for (let i = 0; i < width; i++) {
          if (used.has(i)) continue;
          let hits = 0;
          let total = 0;
          for (const r of rows) {
            const v = (r[i] ?? "").trim();
            if (!v) continue;
            total++;
            if (preds.every((p) => p(v))) hits++;
          }
          if (total >= 2 && hits / total >= 0.6) {
            column = i;
            confidence = "medium";
            break;
          }
        }
      }
    }

    if (column !== null) used.add(column);
    return {
      field: spec.field,
      label: spec.label,
      required: spec.required,
      column,
      header: column !== null ? headers[column] : null,
      confidence,
      sample: column !== null ? sampleOf(column) : "",
    };
  });
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

/**
 * Parse a money cell: strips currency symbols ($ € £), thousands commas and
 * spaces; "(1,234)" counts as negative. Returns null when not numeric.
 */
export function parseAmount(v: string | null | undefined): number | null {
  if (v == null) return null;
  let s = v.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[$€£,\s]/g, "");
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  return neg ? -r : r;
}

/** Parse an integer cell (commas/spaces tolerated). Null when not an integer. */
export function parseIntCell(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = v.trim().replace(/[,\s]/g, "");
  if (!s) return null;
  if (!INT_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a date cell to YYYY-MM-DD. Accepts ISO plus M/D/YYYY
 * (and M-D-YYYY). Returns null for anything else, including rollovers.
 */
export function normalizeDate(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (DATE_RE.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
      ? s
      : null;
  }
  const mdy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (mdy) {
    let y = Number(mdy[3]);
    if (mdy[3].length === 2) y = y >= 70 ? 1900 + y : 2000 + y;
    return normalizeDate(
      `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row import
// ---------------------------------------------------------------------------

export interface SkippedRow {
  row: number;
  field: string;
  reason: string;
}

export interface ImportResult {
  imported: number;
  skipped: SkippedRow[];
}

/** Throw as new Error("field|reason") — importRows converts to SkippedRow. */
function rowError(field: string, reason: string): never {
  throw new Error(`${field}|${reason}`);
}

function importMetricRow(
  clientId: number,
  cells: string[],
  col: (f: string) => number,
  channelFallback = ""
): { date: string; channel: string; campaign: string; row: Record<string, number | string> } {
  const rawDate = (cells[col("date")] ?? "").trim();
  const date = normalizeDate(rawDate);
  if (!date)
    rowError("date", `Bad date "${rawDate}" — use YYYY-MM-DD or MM/DD/YYYY.`);

  const rawChannel = col("channel") >= 0 ? (cells[col("channel")] ?? "").trim() : "";
  const channel = rawChannel || channelFallback.trim();
  const campaign = col("campaign") >= 0 ? (cells[col("campaign")] ?? "").trim() : "";

  const num = (f: string, int: boolean): number => {
    if (col(f) < 0) return 0;
    const raw = (cells[col(f)] ?? "").trim();
    if (!raw) return 0;
    const v = int ? parseIntCell(raw) : parseAmount(raw);
    if (v === null) rowError(f, `Bad value "${raw}" — must be a number.`);
    if (v < 0) rowError(f, `Bad value "${raw}" — must not be negative.`);
    return v;
  };

  return {
    date: date as string,
    channel,
    campaign,
    row: {
      impressions: num("impressions", true),
      clicks: num("clicks", true),
      spend: num("spend", false),
      conversions: num("conversions", true),
      revenue: num("revenue", false),
    },
  };
}

/**
 * Import parsed data rows with user-confirmed column mappings.
 * For every date present in the file, previously imported rows for the same
 * client/channel/campaign are replaced first, so re-uploads never duplicate.
 * Invalid rows are skipped with field-level reasons; valid rows still import.
 * `channelFallback` tags every row whose channel column is unmapped or empty —
 * the multi-channel import flow uses one call per file with its own fallback.
 */
export function importRows(
  clientId: number,
  rows: string[][],
  mappings: Record<string, number | null>,
  opts?: { channelFallback?: string }
): ImportResult {
  const col = (f: string): number => {
    const v = mappings[f];
    return v === null || v === undefined ? -1 : v;
  };
  const missing = FIELDS.filter((s) => s.required && col(s.field) < 0);
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.map((m) => m.label).join(", ")}`);
  }

  const result: ImportResult = { imported: 0, skipped: [] };
  const capped = rows.slice(0, MAX_ROWS);

  // Pre-pass: parse + validate everything before touching the database.
  const parsed: Array<ReturnType<typeof importMetricRow>> = [];
  const channelFallback = (opts?.channelFallback ?? "").trim().slice(0, 120);
  capped.forEach((cells, i) => {
    const rowNum = i + 2; // header is row 1
    try {
      parsed.push(importMetricRow(clientId, cells, col, channelFallback));
      result.imported++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid row.";
      const sep = msg.indexOf("|");
      result.skipped.push({
        row: rowNum,
        field: sep >= 0 ? msg.slice(0, sep) : "row",
        reason: sep >= 0 ? msg.slice(sep + 1) : msg,
      });
    }
  });

  const ins = db.prepare(
    `INSERT INTO metrics (client_id, date, channel, campaign, impressions, clicks, spend, conversions, revenue, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv')`
  );
  const del = db.prepare(
    `DELETE FROM metrics WHERE client_id = ? AND date = ? AND channel = ? AND campaign = ? AND source = 'csv'`
  );

  const tx = db.transaction(() => {
    const seen = new Set<string>();
    for (const p of parsed) {
      const key = `${p.date}|${p.channel}|${p.campaign}`;
      if (!seen.has(key)) {
        seen.add(key);
        del.run(clientId, p.date, p.channel, p.campaign);
      }
      ins.run(
        clientId,
        p.date,
        p.channel,
        p.campaign,
        p.row.impressions,
        p.row.clicks,
        p.row.spend,
        p.row.conversions,
        p.row.revenue
      );
    }
  });
  tx();

  return result;
}

/** Insert or replace a single manually entered metric row. */
export function upsertManualEntry(
  clientId: number,
  entry: {
    date: string;
    channel: string;
    campaign: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  }
): void {
  const date = normalizeDate(entry.date);
  if (!date) throw new Error("Bad date — use YYYY-MM-DD or MM/DD/YYYY.");
  for (const [k, v] of Object.entries(entry)) {
    if (k === "date" || k === "channel" || k === "campaign") continue;
    if (!Number.isFinite(v as number) || (v as number) < 0)
      throw new Error(`Bad value for ${k} — must be a non-negative number.`);
  }
  db.prepare(
    `DELETE FROM metrics WHERE client_id = ? AND date = ? AND channel = ? AND campaign = ? AND source = 'manual'`
  ).run(clientId, date, entry.channel.trim(), entry.campaign.trim());
  db.prepare(
    `INSERT INTO metrics (client_id, date, channel, campaign, impressions, clicks, spend, conversions, revenue, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
  ).run(
    clientId,
    date,
    entry.channel.trim(),
    entry.campaign.trim(),
    Math.round(entry.impressions),
    Math.round(entry.clicks),
    Math.round(entry.spend * 100) / 100,
    Math.round(entry.conversions),
    Math.round(entry.revenue * 100) / 100
  );
}
