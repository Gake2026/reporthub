import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../lib/auth";
import { listInvoices } from "../../../lib/invoices";
import { fmtDate, fmtMoney2 } from "../../../lib/format";
import DeleteButton from "./DeleteButton";
import StatusSelect from "./StatusSelect";

const FILTERS = ["all", "draft", "unpaid", "paid", "overdue"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/");

  const sp = await searchParams;
  const filter = FILTERS.includes(sp.status as (typeof FILTERS)[number])
    ? (sp.status as (typeof FILTERS)[number])
    : "all";

  const all = listInvoices(visibleClientIds(user));
  const invoices = filter === "all" ? all : all.filter((i) => i.status === filter);
  const counts = new Map<string, number>();
  for (const i of all) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);

  return (
    <>
      <div className="pagehead">
        <h1>Invoices</h1>
        <span className="sub">{all.length} total</span>
        <div className="spacer" />
        <Link href="/invoices/new" className="btn btn-primary">
          New invoice
        </Link>
      </div>

      <div className="toolbar">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/invoices" : `/invoices?status=${f}`}
            className={`btn btn-sm${filter === f ? " btn-primary" : ""}`}
          >
            {f === "all" ? `All (${all.length})` : `${f} (${counts.get(f) ?? 0})`}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="empty">
          <h3>No invoices</h3>
          <p>
            {filter === "all"
              ? "Create your first invoice to bill a client."
              : `No ${filter} invoices right now.`}
          </p>
          {filter === "all" && (
            <Link href="/invoices/new" className="btn btn-primary">
              New invoice
            </Link>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} style={{ fontWeight: 600 }}>
                      {inv.number}
                    </Link>
                  </td>
                  <td>{inv.client_name}</td>
                  <td>{fmtDate(inv.issue_date)}</td>
                  <td>{fmtDate(inv.due_date)}</td>
                  <td>
                    <StatusSelect id={inv.id} status={inv.status} />
                  </td>
                  <td className="num">{fmtMoney2(inv.total)}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <Link href={`/invoices/${inv.id}`} className="btn btn-sm">
                      View
                    </Link>{" "}
                    <Link href={`/invoices/${inv.id}/edit`} className="btn btn-sm">
                      Edit
                    </Link>{" "}
                    {user.role === "owner" && (
                      <DeleteButton id={inv.id} label={inv.number} />
                    )}
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
