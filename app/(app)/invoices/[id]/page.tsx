import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, visibleClientIds } from "../../../../lib/auth";
import { getInvoice } from "../../../../lib/invoices";
import { getSettings } from "../../../../lib/settings";
import InvoiceDoc from "../../../../components/InvoiceDoc";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client") redirect("/");

  const { id } = await params;
  const invoice = getInvoice(Number(id), visibleClientIds(user));
  if (!invoice) notFound();

  const settings = getSettings();

  return (
    <>
      <InvoiceDoc
        invoice={invoice}
        settings={{
          agency_name: settings.agency_name,
          logo_data: settings.logo_data,
          support_email: settings.support_email,
          primary_color: settings.primary_color,
        }}
      />
      <div className="toolbar noprint" style={{ marginTop: 16 }}>
        <Link href={`/invoices/${invoice.id}/edit`} className="btn">
          Edit invoice
        </Link>
      </div>
    </>
  );
}
