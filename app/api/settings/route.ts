import { NextRequest, NextResponse } from "next/server";
import { needUser, bad } from "../../../lib/api";
import { getSettings, updateSettings } from "../../../lib/settings";

export async function GET() {
  const r = await needUser();
  if (r instanceof NextResponse) return r;
  // Any signed-in user may read branding (client dashboards need it).
  return NextResponse.json(getSettings());
}

export async function PUT(req: NextRequest) {
  const r = await needUser(["owner"]);
  if (r instanceof NextResponse) return r;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") patch[k] = v;
  }
  if (patch.agency_name !== undefined && !patch.agency_name.trim())
    return bad("Agency name is required.");
  for (const k of ["primary_color", "accent_color"]) {
    if (patch[k] !== undefined && !/^#[0-9a-fA-F]{6}$/.test(patch[k]))
      return bad("Colors must be hex values like #4f46e5.");
  }
  try {
    return NextResponse.json(updateSettings(patch));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Could not save settings.");
  }
}
