// Deterministic performance summaries: short plain-English paragraphs about
// what moved and why, computed from metric data only. No external calls,
// no branded inference — pure template logic over the numbers.

import { getPeriodData } from "./metrics";
import { fmtMoney, fmtNum } from "./format";

function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function moveWord(p: number | null): string {
  if (p == null) return "held steady";
  if (Math.abs(p) < 1) return "held steady";
  return p > 0 ? `rose ${p.toFixed(1)}%` : `fell ${Math.abs(p).toFixed(1)}%`;
}

/** 2–4 plain-English paragraphs summarizing the period. */
export function buildSummary(clientId: number, from: string, to: string): string[] {
  const data = getPeriodData(clientId, from, to);
  const { kpis, prev, channels } = data;
  const out: string[] = [];

  const spendP = pct(kpis.spend, prev.spend);
  const convP = pct(kpis.conversions, prev.conversions);
  const cpaP = kpis.cpa != null && prev.cpa != null ? pct(kpis.cpa, prev.cpa) : null;

  out.push(
    `From ${from} to ${to}, ad spend ${moveWord(spendP)} to ${fmtMoney(kpis.spend)} ` +
      `and conversions ${moveWord(convP)} to ${fmtNum(kpis.conversions)}. ` +
      (kpis.cpa != null
        ? `Cost per acquisition ${moveWord(cpaP)} to ${fmtMoney(kpis.cpa)}.`
        : `No conversions were recorded in this period.`)
  );

  if (kpis.revenue > 0) {
    const revP = pct(kpis.revenue, prev.revenue);
    out.push(
      `Attributed revenue ${moveWord(revP)} to ${fmtMoney(kpis.revenue)}` +
        (kpis.roas != null ? `, a ${kpis.roas.toFixed(2)}x return on ad spend.` : ".")
    );
  }

  const withCpa = channels.filter((c) => c.cpa != null && c.spend > 0);
  if (withCpa.length >= 2) {
    const best = [...withCpa].sort((a, b) => (a.cpa as number) - (b.cpa as number))[0];
    const worst = [...withCpa].sort((a, b) => (b.cpa as number) - (a.cpa as number))[0];
    out.push(
      `${best.channel} was the most efficient channel at ${fmtMoney(best.cpa as number)} per acquisition, ` +
        `while ${worst.channel} was the least efficient at ${fmtMoney(worst.cpa as number)}.`
    );
  } else if (channels.length > 0) {
    const top = [...channels].sort((a, b) => b.spend - a.spend)[0];
    out.push(
      `${top.channel} drove the most spend at ${fmtMoney(top.spend)}, ` +
        `${fmtNum(top.conversions)} conversions.`
    );
  }

  if (channels.length >= 2) {
    const total = channels.reduce((s, c) => s + c.spend, 0);
    if (total > 0) {
      const sorted = [...channels].sort((a, b) => b.spend - a.spend);
      const leader = sorted[0];
      out.push(
        `Spend is concentrated in ${leader.channel} (${((leader.spend / total) * 100).toFixed(0)}% of total).`
      );
    }
  }

  return out;
}
