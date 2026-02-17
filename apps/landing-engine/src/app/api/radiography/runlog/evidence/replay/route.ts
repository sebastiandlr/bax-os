import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EvidenceReplayErrorResponseV0Schema,
  EvidenceReplayResponseV0Schema
} from "@bax/radiography-contract";
import { readRunLogById, writeRunLog } from "@/lib/radiography/runlogStorage";
import {
  assertRunlogErrorEnvelope,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";
import {
  computePortableReplayFromEvidenceBundle,
  EvidenceBundleV0Schema,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";

export const runtime = "nodejs";
/**
 * Replay route invariants:
 * - `x-request-id` header is attached to every response (2xx/4xx/5xx).
 * - All non-200 JSON bodies include `request_id` and correlate with the header value.
 * - Internal 500 diagnostics are leak-safe: no raw payload values, zod messages, or nested paths.
 */
const ALLOWED_ISSUES_PATH_KEYS = new Set(["replay", "compare", "persisted"]);
const ALLOWED_REPLAY_ERROR_ISSUES_PATH_KEYS = new Set([
  "root",
  "ok",
  "error",
  "request_id",
  "errors",
  "details"
]);

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

  for (const issue of issues) {
    if (issue.path.length === 0) {
      topLevelPaths.add("root");
      continue;
    }

    const firstSegment = issue.path[0];
    if (typeof firstSegment === "string" && ALLOWED_ISSUES_PATH_KEYS.has(firstSegment)) {
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

const isReplayContractValidationEnabled = () => {
  return process.env.NODE_ENV !== "production" || process.env.BAX_CONTRACT_ASSERTS === "1";
};

const shouldThrowOnReplayContractViolation = () => process.env.BAX_CONTRACT_ASSERTS === "1";

const sanitizeReplayErrorIssuePaths = (issues: z.ZodIssue[]) => {
  const topLevelPaths = new Set<string>();

  for (const issue of issues) {
    if (issue.path.length === 0) {
      topLevelPaths.add("root");
      continue;
    }

    const firstSegment = issue.path[0];
    if (
      typeof firstSegment === "string" &&
      ALLOWED_REPLAY_ERROR_ISSUES_PATH_KEYS.has(firstSegment)
    ) {
      topLevelPaths.add(firstSegment);
      continue;
    }

    topLevelPaths.add("root");
  }

  return [...topLevelPaths].sort((a, b) => a.localeCompare(b));
};

const assertReplayErrorEnvelope = (payload: unknown) => {
  if (!isReplayContractValidationEnabled()) {
    return;
  }

  const parsed = EvidenceReplayErrorResponseV0Schema.safeParse(payload);
  if (parsed.success) {
    return;
  }

  const issues_paths = sanitizeReplayErrorIssuePaths(parsed.error.issues);
  console.error("radiography_contract_violation", {
    route_tag: "runlog/evidence/replay",
    error: "contract_violation",
    issues_count: parsed.error.issues.length,
    issues_paths
  });

  if (shouldThrowOnReplayContractViolation()) {
    throw new Error("contract_violation");
  }
};

const buildReplayErrorResponse = (params: {
  requestId: string;
  status: number;
  payload: {
    ok: false;
    error: string;
    request_id?: string;
    errors?: string[];
    details?: unknown;
    [key: string]: unknown;
  };
}) => {
  const payloadWithRequestId = {
    ...params.payload,
    request_id: params.requestId
  };

  assertReplayErrorEnvelope({
    ok: payloadWithRequestId.ok,
    error: payloadWithRequestId.error,
    request_id: payloadWithRequestId.request_id,
    ...(payloadWithRequestId.errors !== undefined ? { errors: payloadWithRequestId.errors } : {}),
    ...(payloadWithRequestId.details !== undefined ? { details: payloadWithRequestId.details } : {})
  });

  assertRunlogErrorEnvelope(
    {
      ok: payloadWithRequestId.ok,
      error: payloadWithRequestId.error,
      request_id: payloadWithRequestId.request_id,
      ...(payloadWithRequestId.errors !== undefined ? { errors: payloadWithRequestId.errors } : {}),
      ...(payloadWithRequestId.details !== undefined ? { details: payloadWithRequestId.details } : {})
    },
    { routeTag: "runlog/evidence/replay" }
  );

  return withRequestId(
    NextResponse.json(payloadWithRequestId, { status: params.status }),
    params.requestId
  );
};

const buildInternalErrorResponse = (params: {
  request_id: string;
  code: "contract_violation" | "internal_error";
  contractViolationDetails?: ReturnType<typeof buildContractViolationDetails>;
}) => {
  const details =
    params.code === "contract_violation" && params.contractViolationDetails
      ? params.contractViolationDetails
      : { code: "internal_error" as const };

  const logPayload =
    params.code === "contract_violation" && params.contractViolationDetails
      ? {
          request_id: params.request_id,
          status: 500 as const,
          error: "internal_error" as const,
          code: "contract_violation" as const,
          issues_count: params.contractViolationDetails.issues_count,
          issues_paths: params.contractViolationDetails.issues_paths
        }
      : {
          request_id: params.request_id,
          status: 500 as const,
          error: "internal_error" as const,
          code: "internal_error" as const
        };

  console.error("radiography_replay_error", logPayload);

  return buildReplayErrorResponse({
    requestId: params.request_id,
    status: 500,
    payload: {
      ok: false,
      error: "internal_error",
      details
    }
  });
};

export async function POST(request: Request) {
  const request_id = getRequestId(request);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return buildReplayErrorResponse({
        requestId: request_id,
        status: 400,
        payload: {
          ok: false,
          error: "invalid",
          errors: ["body: request body must be valid JSON"]
        }
      });
    }

    const parsedBody = ReplayBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return buildReplayErrorResponse({
        requestId: request_id,
        status: 400,
        payload: {
          ok: false,
          error: "invalid",
          errors: formatIssues(parsedBody.error.issues)
        }
      });
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

      return buildReplayErrorResponse({
        requestId: request_id,
        status,
        payload: {
          ok: false,
          error: replayResult.error,
          details: replayResult.details
        }
      });
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
        return buildReplayErrorResponse({
          requestId: request_id,
          status: 409,
          payload: {
            ok: false,
            error: "run_already_exists"
          }
        });
      }
      if (existingRun.reason !== "not_found") {
        return buildReplayErrorResponse({
          requestId: request_id,
          status: 400,
          payload: {
            ok: false,
            error: "invalid"
          }
        });
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
      return buildInternalErrorResponse({
        request_id,
        code: "contract_violation",
        contractViolationDetails: details
      });
    }

    return withRequestId(NextResponse.json(parsedSuccessPayload.data), request_id);
  } catch {
    return buildInternalErrorResponse({
      request_id,
      code: "internal_error"
    });
  }
}
