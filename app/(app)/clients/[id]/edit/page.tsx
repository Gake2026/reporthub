import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession, canEditClient } from "../../../../../lib/auth";
import ClientForm from "../../ClientForm";
import DeleteClientButton from "./DeleteClientButton";
import db from "../../../../../lib/db";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isFinite(clientId) || !canEditClient(user, clientId)) notFound();

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

  const managers =
    user.role === "owner"
      ? ((db
          .prepare("SELECT id, name FROM users WHERE role = 'manager' AND active = 1 ORDER BY name")
          .all() as Array<{ id: number; name: string }>) ?? [])
      : [];

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Edit client</h1>
          <div className="sub">
            <Link href={`/clients/${clientId}`}>{client.name}</Link>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <ClientForm managers={managers} client={client} />
      </div>
      {user.role === "owner" && (
        <div className="card">
          <h3>Danger zone</h3>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Deleting a client permanently removes their dashboard, all imported
            metrics, and contacts. This cannot be undone.
          </p>
          <DeleteClientButton clientId={clientId} name={client.name} />
        </div>
      )}
    </>
  );
}
