import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../lib/auth";
import { getOverview } from "../../../lib/metrics";
import { fmtMoney } from "../../../lib/format";
import { StatusBadge } from "../../../components/ui";
import ClientForm from "./ClientForm";
import db from "../../../lib/db";
import { TEMPLATES } from "../../../lib/templates";

export default async function ClientsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect(`/clients/${user.client_id}`);

  const { clients } = getOverview(visibleClientIds(user));
  const managers = (
    db.prepare("SELECT id, name FROM users WHERE role = 'manager' AND active = 1 ORDER BY name").all() as Array<{
      id: number;
      name: string;
    }>
  );

  return (
    <>
      <div className="pagehead">
        <h1>Clients</h1>
        <span className="sub">{clients.length} total</span>
      </div>

      {user.role === "owner" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Add a client</h3>
          <ClientForm managers={managers} templates={TEMPLATES} />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Use the form above to add your first client.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>Account manager</th>
                <th className="num">Retainer/mo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} style={{ fontWeight: 600 }}>
                      {c.name}
                    </Link>
                    {c.website && (
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{c.website}</div>
                    )}
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.manager_name || <span style={{ color: "var(--muted)" }}>Unassigned</span>}</td>
                  <td className="num">{fmtMoney(c.retainer)}</td>
                  <td className="num">
                    <Link href={`/clients/${c.id}`} className="btn btn-sm">
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
