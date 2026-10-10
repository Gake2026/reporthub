import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../../../lib/api";
import { canEditClient } from "../../../../../lib/auth";
import {
  parseCSV,
  splitRows,
  detectMappings,
  importRows,
  MAX_BYTES,
} from "../../../../../lib/csv";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  const clientId = Number((await params).id);
  if (!Number.isFinite(clientId) || !canEditClient(r.user, clientId))
    return bad("Not allowed.", 403);

  const body = (await req.json().catch(() => ({}))) as {
    step?: string;
    csv?: string;
    mapping?: Record<string, number | null>;
    channelFallback?: string;
  };
  const csvText = body.csv ?? "";
  if (typeof csvText !== "string" || !csvText.trim())
    return bad("No CSV content received.");
  if (csvText.length > MAX_BYTES) return bad("CSV is too large (max 5MB).");

  let parsed: string[][];
  try {
    parsed = parseCSV(csvText);
  } catch {
    return bad("Could not parse the CSV.");
  }
  const { headers, rows } = splitRows(parsed);
  if (headers.length === 0) return bad("The CSV has no header row.");
  if (rows.length === 0) return bad("The CSV has no data rows.");

  if (body.step === "detect") {
    return NextResponse.json({
      headers,
      detected: detectMappings(headers, rows.slice(0, 200)),
      rowCount: rows.length,
    });
  }

  if (body.step === "commit") {
    if (!body.mapping || typeof body.mapping !== "object")
      return bad("Column mapping is required.");
    try {
      const result = importRows(clientId, rows, body.mapping, {
        channelFallback: body.channelFallback ?? "",
      });
      return NextResponse.json(result);
    } catch (e) {
      return bad(e instanceof Error ? e.message : "Import failed.");
    }
  }

  return bad("Unknown step. Use 'detect' or 'commit'.");
}
