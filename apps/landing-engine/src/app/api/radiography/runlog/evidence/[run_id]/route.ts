import { NextResponse } from "next/server";
import {
  readEvidenceIndexByRunId,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

type RunLogEvidenceRouteContext = {
  params: Promise<{
    run_id: string;
  }>;
};

export async function GET(request: Request, context: RunLogEvidenceRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { run_id } = await context.params;
    if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
      return buildErrorResponse({
        requestId,
        status: 400,
        payload: { ok: false, error: "invalid" }
      });
    }

    const result = await readEvidenceIndexByRunId(run_id);
    if (!result.ok) {
      return buildErrorResponse({
        requestId,
        status: result.reason === "not_found" ? 404 : 400,
        payload: { ok: false, error: result.reason }
      });
    }

    return withRequestId(NextResponse.json({ ok: true, evidence_index: result.evidence_index }), requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read runlog evidence";
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error", message }
    });
  }
}
