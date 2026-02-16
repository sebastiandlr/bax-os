import { NextResponse } from "next/server";
import { z } from "zod";
import { EvidenceReplayResponseV0Schema } from "@bax/radiography-contract";
import { readRunLogById, writeRunLog } from "@/lib/radiography/runlogStorage";
import {
  computePortableReplayFromEvidenceBundle,
  EvidenceBundleV0Schema,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";

const ReplayOptionsSchema = z
  .object({
    persist_stub: z.boolean().optional(),
    run_id: z.string().regex(RUNLOG_RUN_ID_PATTERN).optional(),
    strict: z.boolean().optional()
  })
  .strict();

const ReplayBodySchema = z
  .object({
    bundle: EvidenceBundleV0Schema,
    options: ReplayOptionsSchema.optional()
  })
  .strict();

const formatIssues = (issues: { path: PropertyKey[]; message: string }[]) => {
  return issues.map((issue) => {
    const issuePath =
      issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join(".") : "root";
    return `${issuePath}: ${issue.message}`;
  });
};

const buildContractViolationDetails = (issues: z.ZodIssue[]) => {
  const topLevelPaths = new Set<string>();
  const allowedTopLevelKeys = new Set(["replay", "compare", "persisted"]);

  for (const issue of issues) {
    if (issue.path.length === 0) {
      topLevelPaths.add("root");
      continue;
    }

    const firstSegment = issue.path[0];
    if (typeof firstSegment === "string" && allowedTopLevelKeys.has(firstSegment)) {
      topLevelPaths.add(firstSegment);
      continue;
    }

    topLevelPaths.add("root");
  }

  return {
    code: "contract_violation" as const,
    issues_count: issues.length,
    issues_paths: [...topLevelPaths].sort((a, b) => a.localeCompare(b))
  };
};

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

  const parsedBody = ReplayBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", errors: formatIssues(parsedBody.error.issues) },
      { status: 400 }
    );
  }

  const strict = parsedBody.data.options?.strict ?? true;
  const persist_stub = parsedBody.data.options?.persist_stub ?? false;
  const requested_run_id = persist_stub ? parsedBody.data.options?.run_id : undefined;

  const replayResult = computePortableReplayFromEvidenceBundle({
    bundleInput: parsedBody.data.bundle,
    strict,
    requested_run_id
  });

  if (!replayResult.ok) {
    const status =
      replayResult.error === "bundle_too_large"
        ? 413
        : replayResult.error === "integrity_mismatch"
          ? 409
          : 400;

    return NextResponse.json(
      {
        ok: false,
        error: replayResult.error,
        details: replayResult.details
      },
      { status }
    );
  }

  let persisted:
    | {
        run_id: string;
        is_stub: true;
        source: "portable_replay";
      }
    | undefined;

  if (persist_stub) {
    const existingRun = await readRunLogById(replayResult.result.run_id);
    if (existingRun.ok) {
      return NextResponse.json(
        { ok: false, error: "run_already_exists" },
        { status: 409 }
      );
    }
    if (existingRun.reason !== "not_found") {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }

    await writeRunLog(replayResult.result.runlog_stub);
    persisted = {
      run_id: replayResult.result.run_id,
      is_stub: true,
      source: "portable_replay"
    };
  }

  const successPayload = {
    ok: true,
    replay: {
      run_id: replayResult.result.replay.run_id,
      gating_decision: replayResult.result.replay.gating_decision,
      decision_trace: replayResult.result.replay.decision_trace
    },
    compare: {
      baseline_run_id: replayResult.result.compare.baseline_run_id,
      baseline: replayResult.result.compare.baseline,
      match: replayResult.result.compare.match,
      diff: replayResult.result.compare.diff
    },
    ...(persisted ? { persisted } : {})
  };

  const parsedSuccessPayload = EvidenceReplayResponseV0Schema.safeParse(successPayload);
  if (!parsedSuccessPayload.success) {
    const details = buildContractViolationDetails(parsedSuccessPayload.error.issues);
    console.error("radiography_replay_contract_violation", {
      issues_count: details.issues_count,
      issues_paths: details.issues_paths
    });
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        details
      },
      { status: 500 }
    );
  }

  return NextResponse.json(parsedSuccessPayload.data);
}
