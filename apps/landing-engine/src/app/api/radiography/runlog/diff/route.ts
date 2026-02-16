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
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }

    const fromRunlog = await readRunLogById(from);
    const toRunlog = await readRunLogById(to);

    if (!fromRunlog.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: fromRunlog.reason === "not_found" ? "not_found" : "invalid"
        },
        { status: fromRunlog.reason === "not_found" ? 404 : 400 }
      );
    }

    if (!toRunlog.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: toRunlog.reason === "not_found" ? "not_found" : "invalid"
        },
        { status: toRunlog.reason === "not_found" ? 404 : 400 }
      );
    }

    return NextResponse.json(computeRunLogDiff(fromRunlog.runlog, toRunlog.runlog));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to diff runlogs";
    return NextResponse.json({ ok: false, error: "error", message }, { status: 500 });
  }
}
