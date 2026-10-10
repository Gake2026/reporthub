import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../lib/auth";
import { getOverview } from "../../lib/metrics";
import { getHealthFor } from "../../lib/health";
import { fmtMoney, fmtNum } from "../../lib/format";
import { Kpi, StatusBadge } from "../../components/ui";
import HealthBadge from "../../components/HealthBadge";
import BatchPanel from "../../components/BatchPanel";
import db from "../../lib/db";

export default async function HomePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Client-role users land on their own dashboard, not the agency overview.
  if (user.role === "client") {
    if (!user.client_id) redirect("/login");
    redirect(`/clients/${user.client_id}`);
  }

  const vis = visibleClientIds(user);
  const { clients, mrr, totals30 } = getOverview(vis);
  const health = getHealthFor(vis);
  const healthById = new Map(health.map((h) => [h.client_id, h]));

  const bounds = db.prepare(
    `SELECT MIN(date) AS min, MAX(date) AS max FROM metrics WHERE client_id IN (
       SELECT id FROM clients ${
         vis === "all" ? "" : `WHERE id IN (${vis.map(() => "?").join(",") || "NULL"})`
       })`
  ).get(...(vis === "all" ? [] : vis)) as { min: string | null; max: string | null };
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = bounds.max && bounds.max < today ? bounds.max : today;
  const minDate = bounds.min ?? maxDate;

  const batchClients = clients
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <div className="pagehead">
        <h1>Agency overview</h1>
        <span className="sub">Trailing 30 days across visible clients</span>
        <div className="spacer" />
        {user.role === "owner" && (
          <Link href="/clients" className="btn btn-primary btn-sm">
            Add client
          </Link>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi label="Retainer MRR" value={fmtMoney(mrr)} />
        <Kpi label="Ad spend · 30d" value={fmtMoney(totals30.spend)} />
        <Kpi label="Conversions · 30d" value={fmtNum(totals30.conversions)} />
        <Kpi label="Revenue · 30d" value={fmtMoney(totals30.revenue)} />
        <Kpi label="Active clients" value={String(clients.filter((c) => c.status === "active").length)} />
      </div>

      {batchClients.length > 0 && (
        <BatchPanel clients={batchClients} minDate={minDate} maxDate={maxDate} />
      )}

      {clients.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Add your first client to start building their dashboard.</p>
          {user.role === "owner" && (
            <Link href="/clients" className="btn btn-primary" style={{ marginTop: 12 }}>
              Add client
            </Link>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Health</th>
                <th>Status</th>
                <th>Account manager</th>
                <th className="num">Retainer/mo</th>
                <th className="num">Spend · 30d</th>
                <th className="num">Conv · 30d</th>
                <th className="num">Revenue · 30d</th>
                <th className="num">Data days</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const h = healthById.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} style={{ fontWeight: 600 }}>
                        {c.name}
                      </Link>
                      {c.website && (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.website}</div>
                      )}
                    </td>
                    <td>
                      {h ? (
                        <HealthBadge score={h.score} flag={h.flag} drivers={h.drivers} />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.manager_name || <span style={{ color: "var(--muted)" }}>Unassigned</span>}</td>
                    <td className="num">{fmtMoney(c.retainer)}</td>
                    <td className="num">{fmtMoney(c.spend30)}</td>
                    <td className="num">{fmtNum(c.conversions30)}</td>
                    <td className="num">{fmtMoney(c.revenue30)}</td>
                    <td className="num">
                      {c.dataDays > 0 ? (
                        c.dataDays
                      ) : (
                        <span style={{ color: "var(--amber)", fontWeight: 600 }}>no data</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
