import { redirect } from "next/navigation";
import { getSession } from "../../../lib/auth";
import { RoleBadge } from "../../../components/ui";
import Avatar from "../../../components/Avatar";
import TeamForm from "./TeamForm";
import TeamRowActions from "./TeamRowActions";
import db from "../../../lib/db";

export default async function TeamPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/");

  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.avatar, u.created_at, c.name AS client_name
       FROM users u LEFT JOIN clients c ON c.id = u.client_id
       ORDER BY u.created_at`
    )
    .all() as Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    avatar: string;
    created_at: string;
    client_name: string | null;
  }>;

  const clients = db.prepare("SELECT id, name FROM clients ORDER BY name").all() as Array<{
    id: number;
    name: string;
  }>;

  return (
    <>
      <div className="pagehead">
        <h1>Team</h1>
        <span className="sub">{users.length} accounts</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Add a team member or client login</h3>
        <TeamForm clients={clients} />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Client access</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <Avatar name={u.name} avatar={u.avatar} size={28} />
                    {u.name}
                  </span>
                </td>
                <td>{u.email}</td>
                <td><RoleBadge role={u.role} /></td>
                <td>{u.role === "client" ? u.client_name || "—" : <span style={{ color: "var(--muted)" }}>n/a</span>}</td>
                <td>{u.active ? "Active" : <span style={{ color: "var(--red)" }}>Disabled</span>}</td>
                <td className="num">
                  {u.id !== user.id && (
                    <TeamRowActions id={u.id} name={u.name} active={!!u.active} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
