import { NextResponse } from "next/server";
import {
  readEvidenceBundleByRunId,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

type RunLogEvidenceBundleRouteContext = {
  params: Promise<{
    run_id: string;
  }>;
};

export async function GET(_request: Request, context: RunLogEvidenceBundleRouteContext) {
  try {
    const { run_id } = await context.params;
    if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
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

      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          artifact_id: result.artifact_id
        },
        { status }
      );
    }

    return new Response(`${JSON.stringify(result.bundle, null, 2)}\n`, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"radiography-evidence-${result.bundle.run_id}.json\"`
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
