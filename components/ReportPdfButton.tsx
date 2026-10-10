"use client";

import { useState } from "react";
import type { StoredReport } from "../lib/reports";
import type { InvoiceDocSettings } from "./InvoiceDoc";

/** Client button that downloads the client report as a real PDF file. */
export default function ReportPdfButton({
  report,
  settings,
}: {
  report: StoredReport;
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
          const { downloadReportPdf } = await import("./reportPdf");
          await downloadReportPdf(report, settings);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Preparing…" : "Download PDF"}
    </button>
  );
}
