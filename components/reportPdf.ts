import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StoredReport } from "../lib/reports";
import { fmtDate, fmtMoney, fmtMoney2, fmtNum, fmtPct } from "../lib/format";
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

const KPI_ROWS: Array<{
  label: string;
  key: string;
  format: (v: number | null) => string;
}> = [
  { label: "Ad spend", key: "spend", format: (v) => fmtMoney(v) },
  { label: "Impressions", key: "impressions", format: (v) => fmtNum(v) },
  { label: "Clicks", key: "clicks", format: (v) => fmtNum(v) },
  { label: "Conversions", key: "conversions", format: (v) => fmtNum(v) },
  { label: "Revenue", key: "revenue", format: (v) => fmtMoney(v) },
  { label: "CTR", key: "ctr", format: (v) => fmtPct(v) },
  { label: "CPC", key: "cpc", format: (v) => fmtMoney2(v) },
  { label: "CPA", key: "cpa", format: (v) => fmtMoney(v) },
  {
    label: "ROAS",
    key: "roas",
    format: (v) => (v == null ? "—" : `${v.toFixed(2)}x`),
  },
];

/** Snapshot the rendered trend chart (SVG) into a PNG for the PDF. */
async function trendChartPng(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const svg = document.querySelector(
      "#report-trend-chart svg"
    ) as SVGSVGElement | null;
    if (!svg) return null;
    const W = 1440;
    const H = 520;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(
      new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
    );
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("chart raster failed"));
      im.src = url;
    });
    URL.revokeObjectURL(url);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return { data: canvas.toDataURL("image/png"), w: W, h: H };
  } catch {
    return null;
  }
}

/** Build the client report PDF in the browser and trigger a real file download. */
export async function downloadReportPdf(
  report: StoredReport,
  settings: InvoiceDocSettings
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const [br, bg, bb] = hexToRgb(settings.primary_color || "#6d28d9");
  const { snapshot } = report;
  let y = 56;

  // --- Header: logo + agency ---
  const img = settings.logo_data ? await logoImage(settings.logo_data) : null;
  if (img && img.naturalWidth > 0) {
    const maxW = 130;
    const maxH = 44;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const fmt = settings.logo_data.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(settings.logo_data, fmt, M, y - 8, img.naturalWidth * scale, img.naturalHeight * scale);
  } else {
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(M, y - 8, 40, 40, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text((settings.agency_name.trim()[0] ?? "R").toUpperCase(), M + 20, y + 19, { align: "center" });
  }
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(settings.agency_name, M + 150, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text("Client performance report", M + 150, y + 24);

  y += 56;
  // --- Report title ---
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(report.client_name, M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110, 110, 120);
  doc.text(
    `${fmtDate(report.period_from)} – ${fmtDate(report.period_to)} · generated ${fmtDate(report.created_at.slice(0, 10))}`,
    M,
    y
  );
  y += 14;
  doc.setDrawColor(230, 230, 235);
  doc.line(M, y, W - M, y);
  y += 24;

  // --- Performance summary ---
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Performance summary", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(50, 50, 60);
  if (snapshot.summary.length === 0) {
    doc.setTextColor(140, 140, 150);
    doc.text("No summary was stored for this report.", M, y);
    y += 16;
  } else {
    for (const line of snapshot.summary) {
      const lines = doc.splitTextToSize(`•  ${line}`, W - M * 2);
      if (y + lines.length * 14 > 780) {
        doc.addPage();
        y = 56;
      }
      doc.text(lines, M, y);
      y += lines.length * 14 + 4;
    }
  }
  y += 10;

  // --- Key metrics ---
  if (y > 700) {
    doc.addPage();
    y = 56;
  }
  doc.setTextColor(20, 20, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Key metrics", M, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Metric", "Value"]],
    body: KPI_ROWS.map((row) => [
      row.label,
      row.format((snapshot.kpis[row.key] as number | null | undefined) ?? null),
    ]),
    styles: { fontSize: 10, cellPadding: 7, textColor: [30, 30, 35] },
    headStyles: { fillColor: [br, bg, bb], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    alternateRowStyles: { fillColor: [247, 247, 250] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  // --- Spend trend chart (embedded from the rendered page chart) ---
  // Always stays on page 1: shrinks proportionally to fit the remaining
  // space rather than spilling onto its own page.
  const chart = await trendChartPng();
  if (chart) {
    const fullW = W - M * 2;
    const fullH = (fullW * chart.h) / chart.w;
    const headingH = 34;
    let space = 780 - y - headingH - 16;
    if (space < 90) {
      doc.addPage();
      y = 56;
      space = 780 - y - headingH - 16;
    }
    const scale = Math.min(1, space / fullH);
    const cw = fullW * scale;
    const ch = fullH * scale;
    const cx = M + (fullW - cw) / 2;
    doc.setTextColor(20, 20, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Spend trend", M, y);
    y += 10;
    doc.addImage(chart.data, "PNG", cx, y, cw, ch);
    y += ch + 24;
  }

  // --- By channel (landscape — 10 columns need the width) ---
  const channels = snapshot.channels ?? [];
  if (channels.length > 0) {
    doc.addPage("a4", "landscape");
    let ly = 56;
    doc.setTextColor(20, 20, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`By channel — ${report.client_name}`, M, ly);
    ly += 8;
    autoTable(doc, {
      startY: ly,
      margin: { left: M, right: M },
      head: [["Channel", "Spend", "Impr.", "Clicks", "Conv.", "Revenue", "CTR", "CPC", "CPA", "ROAS"]],
      body: channels.map((c) => [
        String(c.channel ?? ""),
        fmtMoney(c.spend as number | null),
        fmtNum(c.impressions as number | null),
        fmtNum(c.clicks as number | null),
        fmtNum(c.conversions as number | null),
        fmtMoney(c.revenue as number | null),
        fmtPct(c.ctr as number | null),
        fmtMoney2(c.cpc as number | null),
        fmtMoney(c.cpa as number | null),
        c.roas == null ? "—" : `${Number(c.roas).toFixed(2)}x`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [30, 30, 35] },
      headStyles: { fillColor: [br, bg, bb], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
        4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
        7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" },
      },
      alternateRowStyles: { fillColor: [247, 247, 250] },
    });
  }

  const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]+/g, "-");
  doc.save(`report-${safe(report.client_name)}-${report.period_from}-${report.period_to}.pdf`);
}
