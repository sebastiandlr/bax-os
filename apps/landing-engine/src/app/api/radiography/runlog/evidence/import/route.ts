import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EvidenceBundleV0Schema,
  importEvidenceBundle
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

const formatIssues = (issues: { path: PropertyKey[]; message: string }[]) => {
  return issues.map((issue) => {
    const issuePath =
      issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join(".") : "root";
    return `${issuePath}: ${issue.message}`;
  });
};

const ImportBodySchema = z
  .object({
    bundle: EvidenceBundleV0Schema
  })
  .strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid", errors: ["body: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  const parsedBody = ImportBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", errors: formatIssues(parsedBody.error.issues) },
      { status: 400 }
    );
  }

  const result = await importEvidenceBundle(parsedBody.data.bundle);
  if (!result.ok) {
    const status =
      result.error === "run_already_exists"
        ? 409
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

  return NextResponse.json(result);
}
