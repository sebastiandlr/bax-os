import { NextResponse } from "next/server";
import {
  EVIDENCE_ARTIFACT_ID_PATTERN,
  readEvidenceArtifactById,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

type RunLogArtifactRouteContext = {
  params: Promise<{
    run_id: string;
    artifact_id: string;
  }>;
};

export async function GET(_request: Request, context: RunLogArtifactRouteContext) {
  try {
    const { run_id, artifact_id } = await context.params;

    if (!RUNLOG_RUN_ID_PATTERN.test(run_id) || !EVIDENCE_ARTIFACT_ID_PATTERN.test(artifact_id)) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
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

      return NextResponse.json({ ok: false, error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, artifact: result.artifact });
  } catch {
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
