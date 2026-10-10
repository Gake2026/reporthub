import { redirect, notFound } from "next/navigation";
import { getSession, canSeeClient } from "../../../../../lib/auth";
import { getSettings } from "../../../../../lib/settings";
import { getPeriodData } from "../../../../../lib/metrics";
import { buildSummary } from "../../../../../lib/summaries";
import { fmtMoney, fmtMoney2, fmtNum, fmtPct, fmtDate } from "../../../../../lib/format";
import { LineChart } from "../../../../../components/charts";
import SummaryBox from "../../../../../components/SummaryBox";
import PrintButton from "./PrintButton";
import db from "../../../../../lib/db";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isFinite(clientId) || !canSeeClient(user, clientId)) notFound();

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as
    | { id: number; name: string; website: string }
    | undefined;
  if (!client) notFound();

  const sp = await searchParams;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : new Date().toISOString().slice(0, 10);
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : to;
  const data = getPeriodData(clientId, from, to);
  const settings = getSettings();
  const { kpis } = data;
  const summary = buildSummary(clientId, from, to);

  const kpiRows: Array<[string, string]> = [
    ["Ad spend", fmtMoney(kpis.spend)],
    ["Impressions", fmtNum(kpis.impressions)],
    ["Clicks", fmtNum(kpis.clicks)],
    ["Click-through rate", fmtPct(kpis.ctr)],
    ["Conversions", fmtNum(kpis.conversions)],
    ["Cost per conversion", fmtMoney2(kpis.cpa)],
    ["Attributed revenue", fmtMoney(kpis.revenue)],
    ["Return on ad spend", kpis.roas != null ? `${kpis.roas.toFixed(2)}x` : "—"],
  ];

  return (
    <>
      <div className="pagehead noprint">
        <div>
          <h1>Client report</h1>
          <div className="sub">
            {client.name} · {fmtDate(from)} – {fmtDate(to)}
          </div>
        </div>
        <div className="spacer" />
        <PrintButton />
      </div>

      <div className="card">
        <div className="report-head">
          {settings.logo_data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_data} alt="" />
          ) : (
            <span
              className="brand-mark"
              style={{ width: 46, height: 46, fontSize: 22 }}
            >
              {settings.agency_name.trim().charAt(0).toUpperCase() || "R"}
            </span>
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{settings.agency_name}</div>
            <div className="report-meta">
              Performance report · {client.name}
              {client.website ? ` (${client.website})` : ""} · {fmtDate(from)} – {fmtDate(to)}
            </div>
          </div>
        </div>

        <div style={{ margin: "4px 0 20px" }}>
          <SummaryBox paragraphs={summary} />
        </div>

        <h3>Key metrics</h3>        <div className="table-wrap" style={{ boxShadow: "none", marginBottom: 20 }}>
          <table className="data">
            <tbody>
              {kpiRows.map(([label, value]) => (
                <tr key={label}>
                  <td style={{ color: "var(--muted)", width: "60%" }}>{label}</td>
                  <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Spend trend</h3>
        <div style={{ marginBottom: 20 }}>
          <LineChart
            series={[
              {
                name: "Spend",
                color: settings.primary_color,
                points: data.trend.map((t) => ({ x: t.date, y: t.spend })),
              },
              {
                name: "Conversions",
                color: settings.accent_color,
                points: data.trend.map((t) => ({ x: t.date, y: t.conversions })),
              },
            ]}
          />
        </div>

        <h3>Channel breakdown</h3>
        <div className="table-wrap" style={{ boxShadow: "none" }}>
          <table className="data">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Spend</th>
                <th className="num">Clicks</th>
                <th className="num">Conv.</th>
                <th className="num">CPA</th>
                <th className="num">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.channel}>
                  <td style={{ fontWeight: 600 }}>{c.channel}</td>
                  <td className="num">{fmtMoney(c.spend)}</td>
                  <td className="num">{fmtNum(c.clicks)}</td>
                  <td className="num">{fmtNum(c.conversions)}</td>
                  <td className="num">{fmtMoney2(c.cpa)}</td>
                  <td className="num">{c.roas != null ? `${c.roas.toFixed(2)}x` : "—"}</td>
                </tr>
              ))}
              {data.channels.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--muted)" }}>
                    No data in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="report-meta" style={{ marginTop: 20 }}>
          Prepared by {settings.agency_name}
          {settings.support_email ? ` · ${settings.support_email}` : ""} · Generated{" "}
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </>
  );
}
