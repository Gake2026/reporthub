import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice } from "../lib/invoices";
import { fmtDate, fmtMoney2 } from "../lib/format";
import type { InvoiceDocSettings } from "./InvoiceDoc";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function logoImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Build the invoice PDF in the browser and trigger a real file download. */
export async function downloadInvoicePdf(
  invoice: Invoice,
  settings: InvoiceDocSettings
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48; // margin
  const [br, bg, bb] = hexToRgb(settings.primary_color || "#6d28d9");
  let y = 56;

  // --- Header: logo / brand mark + agency ---
  const img = settings.logo_data
    ? await logoImage(settings.logo_data)
    : null;
  if (img && img.naturalWidth > 0) {
    const maxW = 130;
    const maxH = 44;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const fmt = settings.logo_data.startsWith("data:image/png")
      ? "PNG"
      : "JPEG";
    doc.addImage(settings.logo_data, fmt, M, y - 8, w, h);
  } else {
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(M, y - 8, 40, 40, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    const initial = (settings.agency_name.trim()[0] ?? "R").toUpperCase();
    doc.text(initial, M + 20, y + 19, { align: "center" });
  }
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(settings.agency_name, M + 150, y + 8);
  if (settings.support_email) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 120);
    doc.text(settings.support_email, M + 150, y + 24);
  }

  // --- Invoice number + status (right) ---
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(invoice.number, W - M, y + 4, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const st = invoice.status.toUpperCase();
  doc.setTextColor(br, bg, bb);
  doc.text(st, W - M, y + 20, { align: "right" });

  y += 64;
  doc.setDrawColor(230, 230, 235);
  doc.line(M, y, W - M, y);
  y += 22;

  // --- Bill to / dates ---
  doc.setTextColor(110, 110, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("BILL TO", M, y);
  doc.text("ISSUE DATE", M + 260, y);
  doc.text("DUE DATE", M + 400, y);
  y += 15;
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(invoice.client_name, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(fmtDate(invoice.issue_date), M + 260, y);
  doc.text(fmtDate(invoice.due_date), M + 400, y);
  y += 26;

  // --- Line items ---
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["#", "Description", "Qty", "Rate", "Amount"]],
    body: invoice.items.map((it, i) => [
      String(i + 1),
      it.description,
      String(it.qty),
      fmtMoney2(it.rate),
      fmtMoney2(it.qty * it.rate),
    ]),
    styles: { fontSize: 10, cellPadding: 7, textColor: [30, 30, 35] },
    headStyles: {
      fillColor: [br, bg, bb],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 32 },
      2: { halign: "right", cellWidth: 52 },
      3: { halign: "right", cellWidth: 84 },
      4: { halign: "right", cellWidth: 92 },
    },
    alternateRowStyles: { fillColor: [247, 247, 250] },
  });

  // --- Totals ---
  let ty = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY + 22;
  const tx = W - M - 190;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 120);
  doc.text("Subtotal", tx, ty);
  doc.setTextColor(20, 20, 25);
  doc.text(fmtMoney2(invoice.subtotal), W - M, ty, { align: "right" });
  ty += 18;
  doc.setTextColor(110, 110, 120);
  doc.text(`Tax (${invoice.tax_rate}%)`, tx, ty);
  doc.setTextColor(20, 20, 25);
  doc.text(fmtMoney2(invoice.tax), W - M, ty, { align: "right" });
  ty += 22;
  doc.setDrawColor(230, 230, 235);
  doc.line(tx, ty - 10, W - M, ty - 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Total due", tx, ty);
  doc.text(fmtMoney2(invoice.total), W - M, ty, { align: "right" });
  ty += 34;

  // --- Notes ---
  if (invoice.notes) {
    if (ty > 720) {
      doc.addPage();
      ty = 56;
    }
    doc.setTextColor(110, 110, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("NOTES", M, ty);
    ty += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 70);
    const lines = doc.splitTextToSize(invoice.notes, W - M * 2);
    doc.text(lines, M, ty);
  }

  const safe = invoice.number.replace(/[^a-zA-Z0-9-_]+/g, "-");
  doc.save(`invoice-${safe}.pdf`);
}
