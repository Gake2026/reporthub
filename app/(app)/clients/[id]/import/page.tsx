import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession, canEditClient } from "../../../../../lib/auth";
import ImportWizard from "./ImportWizard";
import ManualEntry from "./ManualEntry";
import db from "../../../../../lib/db";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isFinite(clientId) || !canEditClient(user, clientId)) notFound();

  const client = db.prepare("SELECT id, name FROM clients WHERE id = ?").get(clientId) as
    | { id: number; name: string }
    | undefined;
  if (!client) notFound();

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>Add data</h1>
          <div className="sub">
            <Link href={`/clients/${clientId}`}>{client.name}</Link>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Import CSV files</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Export a report from Google Ads, Meta Ads, or any platform and upload
            it here. Columns are detected automatically — you confirm the mapping
            before anything is imported. Re-uploading the same dates replaces the
            previous rows, so duplicates are never created.
          </p>
          <ImportWizard clientId={clientId} />
        </div>

        <div className="card">
          <h3>Add manually</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Add a single day of metrics by hand — useful for channels without exports.
          </p>
          <ManualEntry clientId={clientId} />
        </div>
      </div>
    </>
  );
}
