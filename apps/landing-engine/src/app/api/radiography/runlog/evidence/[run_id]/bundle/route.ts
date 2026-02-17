import {
  readEvidenceBundleByRunId,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

type RunLogEvidenceBundleRouteContext = {
  params: Promise<{
    run_id: string;
  }>;
};

export async function GET(request: Request, context: RunLogEvidenceBundleRouteContext) {
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

    const result = await readEvidenceBundleByRunId(run_id);
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "integrity_mismatch"
            ? 409
            : result.error === "bundle_too_large"
              ? 413
              : result.error === "artifact_not_json"
                ? 422
                : 400;

      return buildErrorResponse({
        requestId,
        status,
        payload: {
          ok: false,
          error: result.error,
          artifact_id: result.artifact_id
        }
      });
    }

    return withRequestId(new Response(`${JSON.stringify(result.bundle, null, 2)}\n`, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"radiography-evidence-${result.bundle.run_id}.json\"`
      }
    }), requestId);
  } catch {
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error" }
    });
  }
}
