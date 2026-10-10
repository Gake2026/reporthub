import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession, canSeeClient, canEditClient } from "../../../../lib/auth";
import { getPeriodData, getDataBounds } from "../../../../lib/metrics";
import { buildSummary } from "../../../../lib/summaries";
import { StatusBadge } from "../../../../components/ui";
import SummaryBox from "../../../../components/SummaryBox";
import FunnelPanel from "../../../../components/FunnelPanel";
import PacingPanel from "../../../../components/PacingPanel";
import PlatformsPanel from "../../../../components/PlatformsPanel";
import BudgetsPanel from "../../../../components/BudgetsPanel";
import DashboardClient from "./DashboardClient";
import db from "../../../../lib/db";

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ClientDashboardPage({
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
  if (!Number.isFinite(clientId)) notFound();
  if (!canSeeClient(user, clientId)) notFound();

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as
    | {
        id: number;
        name: string;
        website: string;
        status: string;
        retainer: number;
        manager_id: number | null;
        notes: string;
      }
    | undefined;
  if (!client) notFound();

  const contacts = db
    .prepare("SELECT * FROM client_contacts WHERE client_id = ? ORDER BY name")
    .all(clientId) as Array<{ id: number; name: string; email: string; role: string }>;
  const manager = client.manager_id
    ? (db.prepare("SELECT name FROM users WHERE id = ?").get(client.manager_id) as { name: string } | undefined)
    : null;

  const bounds = getDataBounds(clientId);
  const today = new Date().toISOString().slice(0, 10);
  const dataMax = bounds.max && bounds.max < today ? bounds.max : today;
  const sp = await searchParams;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : dataMax;
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : shiftDays(to, -29);

  const data = getPeriodData(clientId, from, to);
  const editable = canEditClient(user, clientId);
  const hasData = data.trend.some(
    (t) => t.spend > 0 || t.clicks > 0 || t.impressions > 0
  );
  const summary = hasData ? buildSummary(clientId, from, to) : [];

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{client.name}</h1>
          <div className="sub">
            <StatusBadge status={client.status} />
            {client.website && <span style={{ marginLeft: 10 }}>{client.website}</span>}
            {manager && <span style={{ marginLeft: 10 }}>· {manager.name}</span>}
          </div>
        </div>
        <div className="spacer" />
        {editable && (
          <>
            <Link href={`/clients/${clientId}/report?from=${from}&to=${to}`} className="btn btn-sm">
              Print report
            </Link>
            <Link href={`/clients/${clientId}/import`} className="btn btn-primary btn-sm">
              Import data
            </Link>
          </>
        )}
      </div>

      {!hasData ? (
        <div className="empty">
          <h3>No metrics yet for this period</h3>
          <p>
            {editable
              ? "Upload a CSV export from the ad platforms to populate this dashboard."
              : "Your agency hasn't added data for this period yet."}
          </p>
          {editable && (
            <Link href={`/clients/${clientId}/import`} className="btn btn-primary" style={{ marginTop: 12 }}>
              Import data
            </Link>
          )}
        </div>
      ) : (
        <>
          {summary.length > 0 && <SummaryBox paragraphs={summary} />}
          <DashboardClient
            clientId={clientId}
            from={from}
            to={to}
            data={data}
            contacts={contacts}
            notes={client.notes}
            editable={editable}
          />
          <div className="grid" style={{ marginTop: 20 }}>
            <FunnelPanel clientId={clientId} from={from} to={to} />
            <PacingPanel clientId={clientId} />
          </div>
          {editable && (
            <div className="grid" style={{ marginTop: 20 }}>
              <PlatformsPanel clientId={clientId} editable={editable} />
              <BudgetsPanel clientId={clientId} editable={editable} />
            </div>
          )}
        </>
      )}
    </>
  );
}
