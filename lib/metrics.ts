// Metric aggregations over the raw per-day/channel metrics table.
// Derived metrics: CTR = clicks/impressions, CPC = spend/clicks,
// CPA = spend/conversions, ROAS = revenue/spend.

import db from "./db";

export interface Kpis {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
}

export interface TrendPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface ChannelRow extends Kpis {
  channel: string;
}

export interface PeriodData {
  from: string;
  to: string;
  kpis: Kpis;
  trend: TrendPoint[];
  channels: ChannelRow[];
}

const ZERO: Kpis = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
  ctr: null,
  cpc: null,
  cpa: null,
  roas: null,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function derive(t: {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}): Kpis {
  return {
    spend: round2(t.spend),
    impressions: t.impressions,
    clicks: t.clicks,
    conversions: t.conversions,
    revenue: round2(t.revenue),
    ctr: t.impressions > 0 ? round2((t.clicks / t.impressions) * 100) : null,
    cpc: t.clicks > 0 ? round2(t.spend / t.clicks) : null,
    cpa: t.conversions > 0 ? round2(t.spend / t.conversions) : null,
    roas: t.spend > 0 ? round2(t.revenue / t.spend) : null,
  };
}

interface TotalRow {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

function totals(
  clientId: number,
  from: string,
  to: string,
  channelFilter?: string
): TotalRow {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(spend),0) AS spend,
              COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(conversions),0) AS conversions,
              COALESCE(SUM(revenue),0) AS revenue
       FROM metrics
       WHERE client_id = ? AND date >= ? AND date <= ?
       ${channelFilter ? "AND channel = ?" : ""}`
    )
    .get(
      ...(channelFilter ? [clientId, from, to, channelFilter] : [clientId, from, to])
    ) as TotalRow;
  return {
    spend: row.spend,
    impressions: Math.round(row.impressions),
    clicks: Math.round(row.clicks),
    conversions: Math.round(row.conversions),
    revenue: row.revenue,
  };
}

function trend(clientId: number, from: string, to: string): TrendPoint[] {
  const rows = db
    .prepare(
      `SELECT date,
              COALESCE(SUM(spend),0) AS spend,
              COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(conversions),0) AS conversions,
              COALESCE(SUM(revenue),0) AS revenue
       FROM metrics
       WHERE client_id = ? AND date >= ? AND date <= ?
       GROUP BY date ORDER BY date`
    )
    .all(clientId, from, to) as Array<
    TrendPoint & { date: string }
  >;
  // Fill gaps so the line chart is continuous.
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: TrendPoint[] = [];
  const d = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    const r = byDate.get(key);
    out.push({
      date: key,
      spend: round2(r?.spend ?? 0),
      impressions: Math.round(r?.impressions ?? 0),
      clicks: Math.round(r?.clicks ?? 0),
      conversions: Math.round(r?.conversions ?? 0),
      revenue: round2(r?.revenue ?? 0),
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function channels(clientId: number, from: string, to: string): ChannelRow[] {
  const rows = db
    .prepare(
      `SELECT channel,
              COALESCE(SUM(spend),0) AS spend,
              COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(conversions),0) AS conversions,
              COALESCE(SUM(revenue),0) AS revenue
       FROM metrics
       WHERE client_id = ? AND date >= ? AND date <= ?
       GROUP BY channel ORDER BY spend DESC`
    )
    .all(clientId, from, to) as Array<TotalRow & { channel: string }>;
  return rows.map((r) => ({
    channel: r.channel || "(unspecified)",
    ...derive({
      spend: r.spend,
      impressions: Math.round(r.impressions),
      clicks: Math.round(r.clicks),
      conversions: Math.round(r.conversions),
      revenue: r.revenue,
    }),
  }));
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Full dashboard dataset for a client and period, plus previous-period KPIs. */
export function getPeriodData(
  clientId: number,
  from: string,
  to: string
): PeriodData & { prev: Kpis } {
  const len =
    Math.round(
      (new Date(to + "T12:00:00").getTime() -
        new Date(from + "T12:00:00").getTime()) /
        86400000
    ) + 1;
  const prevTo = shiftDays(from, -1);
  const prevFrom = shiftDays(from, -len);
  return {
    from,
    to,
    kpis: derive(totals(clientId, from, to)),
    trend: trend(clientId, from, to),
    channels: channels(clientId, from, to),
    prev: derive(totals(clientId, prevFrom, prevTo)),
  };
}

export interface ClientOverview {
  id: number;
  name: string;
  website: string;
  status: string;
  retainer: number;
  manager_name: string | null;
  spend30: number;
  conversions30: number;
  revenue30: number;
  dataDays: number;
}

/** Agency overview: every visible client with trailing-30-day totals + MRR. */
export function getOverview(clientIds: number[] | "all"): {
  clients: ClientOverview[];
  mrr: number;
  totals30: Kpis;
} {
  const where = clientIds === "all" ? "" : `WHERE c.id IN (${clientIds.map(() => "?").join(",") || "NULL"})`;
  const params = clientIds === "all" ? [] : clientIds;
  const clients = db
    .prepare(
      `SELECT c.id, c.name, c.website, c.status, c.retainer, u.name AS manager_name
       FROM clients c LEFT JOIN users u ON u.id = c.manager_id
       ${where} ORDER BY c.name`
    )
    .all(...params) as Array<{
    id: number;
    name: string;
    website: string;
    status: string;
    retainer: number;
    manager_name: string | null;
  }>;

  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDays(to, -29);
  const out: ClientOverview[] = clients.map((c) => {
    const t = totals(c.id, from, to);
    const days = (
      db
        .prepare(
          "SELECT COUNT(DISTINCT date) AS d FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?"
        )
        .get(c.id, from, to) as { d: number }
    ).d;
    return {
      ...c,
      spend30: round2(t.spend),
      conversions30: t.conversions,
      revenue30: round2(t.revenue),
      dataDays: days,
    };
  });

  const mrr = round2(
    clients
      .filter((c) => c.status === "active")
      .reduce((s, c) => s + (c.retainer || 0), 0)
  );
  const agg = out.reduce(
    (s, c) => ({
      spend: s.spend + c.spend30,
      conversions: s.conversions + c.conversions30,
      revenue: s.revenue + c.revenue30,
    }),
    { spend: 0, conversions: 0, revenue: 0 }
  );
  return {
    clients: out,
    mrr,
    totals30: { ...ZERO, spend: round2(agg.spend), conversions: agg.conversions, revenue: round2(agg.revenue) },
  };
}

/** Date bounds of a client's data (for the range picker defaults). */
export function getDataBounds(clientId: number): { min: string | null; max: string | null } {
  const row = db
    .prepare(
      "SELECT MIN(date) AS min, MAX(date) AS max FROM metrics WHERE client_id = ?"
    )
    .get(clientId) as { min: string | null; max: string | null };
  return row;
}
