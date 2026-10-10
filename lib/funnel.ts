// Funnel + channel-contribution analytics, computed from metric data.

import db from "./db";

export interface FunnelStage {
  stage: string;
  value: number;
  rateFromPrev: number | null; // conversion rate from the previous stage
}

export interface FunnelData {
  from: string;
  to: string;
  stages: FunnelStage[];
  channels: Array<{
    channel: string;
    spend: number;
    conversions: number;
    spendShare: number; // % of total spend
    conversionShare: number; // % of total conversions
  }>;
}

export function getFunnel(clientId: number, from: string, to: string): FunnelData {
  const t = db
    .prepare(
      `SELECT COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(clicks),0) AS clicks,
              COALESCE(SUM(spend),0) AS spend,
              COALESCE(SUM(conversions),0) AS conversions,
              COALESCE(SUM(revenue),0) AS revenue
       FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?`
    )
    .get(clientId, from, to) as {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    revenue: number;
  };

  const rate = (a: number, b: number): number | null =>
    b > 0 ? Math.round((a / b) * 1000) / 10 : null;

  const stages: FunnelStage[] = [
    { stage: "Impressions", value: Math.round(t.impressions), rateFromPrev: null },
    { stage: "Clicks", value: Math.round(t.clicks), rateFromPrev: rate(t.clicks, t.impressions) },
    { stage: "Conversions", value: Math.round(t.conversions), rateFromPrev: rate(t.conversions, t.clicks) },
    { stage: "Revenue", value: Math.round(t.revenue * 100) / 100, rateFromPrev: null },
  ];

  const chRows = db
    .prepare(
      `SELECT channel,
              COALESCE(SUM(spend),0) AS spend,
              COALESCE(SUM(conversions),0) AS conversions
       FROM metrics WHERE client_id = ? AND date >= ? AND date <= ?
       GROUP BY channel ORDER BY spend DESC`
    )
    .all(clientId, from, to) as Array<{ channel: string; spend: number; conversions: number }>;
  const totalSpend = chRows.reduce((s, r) => s + r.spend, 0);
  const totalConv = chRows.reduce((s, r) => s + r.conversions, 0);

  return {
    from,
    to,
    stages,
    channels: chRows.map((r) => ({
      channel: r.channel || "(unspecified)",
      spend: Math.round(r.spend * 100) / 100,
      conversions: Math.round(r.conversions),
      spendShare: totalSpend > 0 ? Math.round((r.spend / totalSpend) * 1000) / 10 : 0,
      conversionShare: totalConv > 0 ? Math.round((r.conversions / totalConv) * 1000) / 10 : 0,
    })),
  };
}
