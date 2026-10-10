import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../../lib/auth";
import { getReport } from "../../../../lib/reports";
import { getSettings } from "../../../../lib/settings";
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct } from "../../../../lib/format";
import { PrintButton } from "../../../../components/InvoiceDoc";
import ReportPdfButton from "../../../../components/ReportPdfButton";

const KPI_ROWS: Array<{
  label: string;
  format: (v: number | null) => string;
  key: string;
}> = [
  { label: "Ad spend", key: "spend", format: (v) => fmtMoney(v) },
  { label: "Impressions", key: "impressions", format: (v) => fmtNum(v) },
  { label: "Clicks", key: "clicks", format: (v) => fmtNum(v) },
  { label: "Conversions", key: "conversions", format: (v) => fmtNum(v) },
  { label: "Revenue", key: "revenue", format: (v) => fmtMoney(v) },
  { label: "CTR", key: "ctr", format: (v) => fmtPct(v) },
  { label: "CPC", key: "cpc", format: (v) => fmtMoney2(v) },
  { label: "CPA", key: "cpa", format: (v) => fmtMoney(v) },
  {
    label: "ROAS",
    key: "roas",
    format: (v) => (v == null ? "—" : `${v.toFixed(2)}x`),
  },
];

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

  const { snapshot } = report;
  const channels = snapshot.channels ?? [];
  const settings = getSettings();

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

      <div className="pagehead">
        <h1>{report.client_name}</h1>
        <span className="sub">
          {fmtDate(report.period_from)} – {fmtDate(report.period_to)} · generated{" "}
          {fmtDate(report.created_at.slice(0, 10))}
        </span>
      </div>

      <div className="card">
        <h3>Performance summary</h3>
        {snapshot.summary.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No summary was stored for this report.</p>
        ) : (
          snapshot.summary.map((line, i) => <p key={i}>{line}</p>)
        )}
      </div>

      <div className="spacer" style={{ height: 16 }} />

      <div className="card">
        <h3>Key metrics</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {KPI_ROWS.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="num">
                    {row.format(
                      (snapshot.kpis[row.key] as number | null | undefined) ?? null
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="spacer" style={{ height: 16 }} />

      <div className="card">
        <h3>By channel</h3>
        {channels.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No channel data for this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Spend</th>
                  <th className="num">Impr.</th>
                  <th className="num">Clicks</th>
                  <th className="num">Conv.</th>
                  <th className="num">Revenue</th>
                  <th className="num">CTR</th>
                  <th className="num">CPC</th>
                  <th className="num">CPA</th>
                  <th className="num">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{String(c.channel ?? "")}</td>
                    <td className="num">{fmtMoney(c.spend as number | null)}</td>
                    <td className="num">{fmtNum(c.impressions as number | null)}</td>
                    <td className="num">{fmtNum(c.clicks as number | null)}</td>
                    <td className="num">{fmtNum(c.conversions as number | null)}</td>
                    <td className="num">{fmtMoney(c.revenue as number | null)}</td>
                    <td className="num">{fmtPct(c.ctr as number | null)}</td>
                    <td className="num">{fmtMoney2(c.cpc as number | null)}</td>
                    <td className="num">{fmtMoney(c.cpa as number | null)}</td>
                    <td className="num">
                      {c.roas == null ? "—" : `${Number(c.roas).toFixed(2)}x`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
