import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../../lib/auth";
import { getReport } from "../../../../lib/reports";
import { getSettings } from "../../../../lib/settings";
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct } from "../../../../lib/format";
import { LineChart } from "../../../../components/charts";
import SummaryBox from "../../../../components/SummaryBox";
import { PrintButton } from "../../../../components/InvoiceDoc";
import ReportPdfButton from "../../../../components/ReportPdfButton";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "manager") redirect("/");

  const { id } = await params;
  const report = getReport(Number(id), visibleClientIds(user));
  if (!report) notFound();

  const settings = getSettings();
  const { snapshot } = report;
  const k = (key: string): number | null =>
    (snapshot.kpis[key] as number | null | undefined) ?? null;

  const kpiRows: Array<[string, string]> = [
    ["Ad spend", fmtMoney(k("spend"))],
    ["Impressions", fmtNum(k("impressions"))],
    ["Clicks", fmtNum(k("clicks"))],
    ["Click-through rate", fmtPct(k("ctr"))],
    ["Conversions", fmtNum(k("conversions"))],
    ["Cost per conversion", fmtMoney2(k("cpa"))],
    ["Attributed revenue", fmtMoney(k("revenue"))],
    ["Return on ad spend", k("roas") != null ? `${(k("roas") as number).toFixed(2)}x` : "—"],
  ];

  const channels = snapshot.channels ?? [];
  const trend = snapshot.trend ?? [];

  return (
    <>
      <div className="toolbar noprint">
        <Link href="/reports" className="btn btn-sm">
          ← Report library
        </Link>
        <div className="spacer" />
        <PrintButton />
        <ReportPdfButton
          report={report}
          settings={{
            agency_name: settings.agency_name,
            logo_data: settings.logo_data,
            support_email: settings.support_email,
            primary_color: settings.primary_color,
          }}
        />
      </div>

      <div className="pagehead noprint">
        <div>
          <h1>Client report</h1>
          <div className="sub">
            {report.client_name} · {fmtDate(report.period_from)} –{" "}
            {fmtDate(report.period_to)}
          </div>
        </div>
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
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {settings.agency_name}
            </div>
            <div className="report-meta">
              Performance report · {report.client_name}
              {report.client_website ? ` (${report.client_website})` : ""} ·{" "}
              {fmtDate(report.period_from)} – {fmtDate(report.period_to)}
            </div>
          </div>
        </div>

        <div style={{ margin: "4px 0 20px" }}>
          <SummaryBox paragraphs={snapshot.summary} />
        </div>

        <h3>Key metrics</h3>
        <div className="table-wrap" style={{ boxShadow: "none", marginBottom: 20 }}>
          <table className="data">
            <tbody>
              {kpiRows.map(([label, value]) => (
                <tr key={label}>
                  <td style={{ color: "var(--muted)", width: "60%" }}>{label}</td>
                  <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Spend trend</h3>
        <div style={{ marginBottom: 20 }}>
          {trend.length > 0 ? (
            <div id="report-trend-chart">
              <LineChart
                series={[
                  {
                    name: "Spend",
                    color: settings.primary_color,
                    points: trend.map((t) => ({ x: t.date, y: t.spend })),
                  },
                  {
                    name: "Conversions",
                    color: settings.accent_color,
                    points: trend.map((t) => ({ x: t.date, y: t.conversions })),
                  },
                ]}
              />
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>
              Trend chart isn&apos;t stored for reports generated before this
              update — regenerate the report to include it.
            </p>
          )}
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
              {channels.map((c, i) => {
                const roas = c.roas as number | null | undefined;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{String(c.channel ?? "")}</td>
                    <td className="num">{fmtMoney(c.spend as number | null)}</td>
                    <td className="num">{fmtNum(c.clicks as number | null)}</td>
                    <td className="num">{fmtNum(c.conversions as number | null)}</td>
                    <td className="num">{fmtMoney2(c.cpa as number | null)}</td>
                    <td className="num">
                      {roas == null ? "—" : `${Number(roas).toFixed(2)}x`}
                    </td>
                  </tr>
                );
              })}
              {channels.length === 0 && (
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
          {fmtDate(report.created_at.slice(0, 10))}
        </p>
      </div>
    </>
  );
}
