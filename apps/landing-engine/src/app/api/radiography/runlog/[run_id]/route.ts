import { NextResponse } from "next/server";
import { readRunLogById } from "@/lib/radiography/runlogStorage";
import { RUNLOG_RUN_ID_PATTERN } from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

type RunLogRouteContext = {
  params: Promise<{
    run_id: string;
  }>;
};

export async function GET(_request: Request, context: RunLogRouteContext) {
  try {
    const { run_id } = await context.params;
    if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
      return NextResponse.json({ ok: false, reason: "invalid" });
    }

    const result = await readRunLogById(run_id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason });
    }
    return NextResponse.json({ ok: true, runlog: result.runlog });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read runlog";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}
