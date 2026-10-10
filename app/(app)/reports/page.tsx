import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../lib/auth";
import { listReports } from "../../../lib/reports";
import { fmtDate } from "../../../lib/format";

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner" && user.role !== "manager") redirect("/");

  const reports = listReports(visibleClientIds(user));

  return (
    <>
      <div className="pagehead">
        <h1>Report library</h1>
        <span className="sub">{reports.length} generated</span>
      </div>

      {reports.length === 0 ? (
        <div className="empty">
          <h3>No reports yet</h3>
          <p>
            Generate a report for one or more clients and it will appear here as a
            permanent snapshot of that period.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Period</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.client_name}</td>
                  <td>
                    {fmtDate(r.period_from)} – {fmtDate(r.period_to)}
                  </td>
                  <td style={{ color: "var(--muted)" }}>
                    {fmtDate(r.created_at.slice(0, 10))}
                  </td>
                  <td className="num">
                    <Link href={`/reports/${r.id}`} className="btn btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
