import { NextResponse } from "next/server";
import {
  readEvidenceIndexByRunId,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

type RunLogEvidenceRouteContext = {
  params: Promise<{
    run_id: string;
  }>;
};

export async function GET(_request: Request, context: RunLogEvidenceRouteContext) {
  try {
    const { run_id } = await context.params;
    if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }

    const result = await readEvidenceIndexByRunId(run_id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: result.reason === "not_found" ? 404 : 400 }
      );
    }

    return NextResponse.json({ ok: true, evidence_index: result.evidence_index });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read runlog evidence";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}
