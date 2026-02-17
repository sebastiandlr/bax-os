import { NextResponse } from "next/server";
import {
  EVIDENCE_ARTIFACT_ID_PATTERN,
  readEvidenceArtifactById,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

type RunLogArtifactRouteContext = {
  params: Promise<{
    run_id: string;
    artifact_id: string;
  }>;
};

export async function GET(request: Request, context: RunLogArtifactRouteContext) {
  const requestId = getRequestId(request);

  try {
    const { run_id, artifact_id } = await context.params;

    if (!RUNLOG_RUN_ID_PATTERN.test(run_id) || !EVIDENCE_ARTIFACT_ID_PATTERN.test(artifact_id)) {
      return buildErrorResponse({
        requestId,
        status: 400,
        payload: { ok: false, error: "invalid" }
      });
    }

    const result = await readEvidenceArtifactById(run_id, artifact_id);
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "integrity_mismatch"
            ? 409
            : result.error === "artifact_not_json"
              ? 422
              : 400;

      return buildErrorResponse({
        requestId,
        status,
        payload: { ok: false, error: result.error }
      });
    }

    return withRequestId(NextResponse.json({ ok: true, artifact: result.artifact }), requestId);
  } catch {
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error" }
    });
  }
}
