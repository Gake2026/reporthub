import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSession, visibleClientIds, COOKIE_NAME } from "../../../../lib/auth";
import { getOverview } from "../../../../lib/metrics";
import InvoiceForm, { type InvoicePayload } from "../../../../components/InvoiceForm";

async function apiBase(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function NewInvoicePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/");

  const { clients } = getOverview(visibleClientIds(user));

  async function create(
    payload: InvoicePayload
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const me = await getSession();
    if (!me || me.role === "client") return { ok: false, error: "Not allowed." };
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const res = await fetch(`${await apiBase()}/api/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `${COOKIE_NAME}=${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok)
      return { ok: false, error: data.error || "Could not create the invoice." };
    redirect("/invoices");
  }

  return (
    <>
      <div className="pagehead">
        <h1>New invoice</h1>
        <span className="sub">Bill a client for work delivered</span>
      </div>

      {clients.length === 0 ? (
        <div className="empty">
          <h3>No clients yet</h3>
          <p>Add a client before creating an invoice.</p>
          <Link href="/clients" className="btn btn-primary">
            Go to clients
          </Link>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 840 }}>
          <InvoiceForm
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            onSubmit={create}
          />
        </div>
      )}
    </>
  );
}
