"use client";

/*
 * NOTE: this module is a client module ("use client") so that the small
 * PrintButton can live in the same file as the document, as specified.
 * "use client" is file-level in React — a server-component module cannot
 * contain a client sub-component. InvoiceDoc itself is pure presentational
 * markup from serializable props, so it still server-renders to identical
 * HTML; only the print button hydrates.
 */

import Link from "next/link";
import { useState } from "react";
import type { Invoice } from "../lib/invoices";
import { fmtDate, fmtMoney2 } from "../lib/format";
import { StatusBadge } from "./ui";

export interface InvoiceDocSettings {
  agency_name: string;
  logo_data: string;
  support_email: string;
  primary_color: string;
}

/** Small client button that opens the print dialog. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn noprint" onClick={() => window.print()}>
      {label}
    </button>
  );
}

/** Small client button that downloads the invoice as a real PDF file. */
export function DownloadPdfButton({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: InvoiceDocSettings;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary noprint"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { downloadInvoicePdf } = await import("./invoicePdf");
          await downloadInvoicePdf(invoice, settings);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Preparing…" : "Download PDF"}
    </button>
  );
}

function BrandMark({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 10,
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 22,
        flexShrink: 0,
      }}
    >
      {(name.trim()[0] ?? "R").toUpperCase()}
    </div>
  );
}

export default function InvoiceDoc({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: InvoiceDocSettings;
}) {
  return (
    <>
      <div className="toolbar noprint">
        <Link href="/invoices" className="btn btn-sm">
          ← All invoices
        </Link>
        <div className="spacer" />
        <PrintButton />
        <DownloadPdfButton invoice={invoice} settings={settings} />
      </div>

      <div className="card invoice-sheet">
        <div className="report-head">
          {settings.logo_data ? (
            <img src={settings.logo_data} alt="" />
          ) : (
            <BrandMark name={settings.agency_name} color={settings.primary_color} />
          )}
          <div>
            <h2 style={{ margin: 0 }}>{settings.agency_name}</h2>
            {settings.support_email && (
              <div className="report-meta">{settings.support_email}</div>
            )}
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{invoice.number}</div>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <div className="field">Bill to</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{invoice.client_name}</div>
          </div>
          <div className="form-group">
            <div className="field">Issue date</div>
            <div>{fmtDate(invoice.issue_date)}</div>
          </div>
          <div className="form-group">
            <div className="field">Due date</div>
            <div>{fmtDate(invoice.due_date)}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Description</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={it.id}>
                  <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                  <td>{it.description}</td>
                  <td className="num">{it.qty}</td>
                  <td className="num">{fmtMoney2(it.rate)}</td>
                  <td className="num">{fmtMoney2(it.qty * it.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--muted)" }}>Subtotal</span>
              <span className="num">{fmtMoney2(invoice.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--muted)" }}>Tax ({invoice.tax_rate}%)</span>
              <span className="num">{fmtMoney2(invoice.tax)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: 18,
                borderTop: "1px solid var(--border)",
                paddingTop: 8,
              }}
            >
              <span>Total due</span>
              <span className="num">{fmtMoney2(invoice.total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 28 }}>
            <div className="field">Notes</div>
            <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{invoice.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
