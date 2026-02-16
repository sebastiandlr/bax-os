import { NextResponse } from "next/server";
import { computeRunLogDiff, RUNLOG_RUN_ID_PATTERN } from "@/lib/radiography/runlogUtils";
import { readRunLogById } from "@/lib/radiography/runlogStorage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to || !RUNLOG_RUN_ID_PATTERN.test(from) || !RUNLOG_RUN_ID_PATTERN.test(to)) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    const fromRunlog = await readRunLogById(from);
    const toRunlog = await readRunLogById(to);

    if (!fromRunlog.ok) {
      return NextResponse.json({
        ok: false,
        reason: fromRunlog.reason === "not_found" ? "not_found" : "invalid"
      });
    }

    if (!toRunlog.ok) {
      return NextResponse.json({
        ok: false,
        reason: toRunlog.reason === "not_found" ? "not_found" : "invalid"
      });
    }

    return NextResponse.json(computeRunLogDiff(fromRunlog.runlog, toRunlog.runlog));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to diff runlogs";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}
