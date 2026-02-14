import { NextResponse } from "next/server";
import { readLatestRunLog } from "@/lib/radiography/runlogStorage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const runlog = await readLatestRunLog();
    if (!runlog) {
      return NextResponse.json({ ok: false, reason: "none" });
    }
    return NextResponse.json({ ok: true, runlog });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read latest runlog";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}
