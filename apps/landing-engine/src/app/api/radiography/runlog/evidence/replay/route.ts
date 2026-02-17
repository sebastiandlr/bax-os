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
/**
 * Replay route invariants:
 * - `x-request-id` header is attached to every response (2xx/4xx/5xx).
 * - All non-200 JSON bodies include `request_id` and correlate with the header value.
 * - Internal 500 diagnostics are leak-safe: no raw payload values, zod messages, or nested paths.
 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const REQUEST_ID_FALLBACK_SANITIZE_PATTERN = /[^a-z0-9-]/g;
const ALLOWED_ISSUES_PATH_KEYS = new Set(["replay", "compare", "persisted"]);

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

const normalizeRequestId = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!REQUEST_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const buildFallbackRequestId = () => {
  const fallbackId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
    .toLowerCase()
    .replace(REQUEST_ID_FALLBACK_SANITIZE_PATTERN, "")
    .slice(0, 80);

  return fallbackId.length > 0 ? fallbackId : "req";
};

const getRequestId = (request: Request) => {
  const incomingRequestId = normalizeRequestId(request.headers.get("x-request-id"));
  if (incomingRequestId) {
    return incomingRequestId;
  }

  const generatedRequestId =
    typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
  const normalizedGeneratedRequestId = normalizeRequestId(generatedRequestId);
  if (normalizedGeneratedRequestId) {
    return normalizedGeneratedRequestId;
  }

  return buildFallbackRequestId();
};

const withRequestId = (response: NextResponse, requestId: string) => {
  response.headers.set("x-request-id", requestId);
  return response;
};

const buildErrorResponse = (params: {
  request_id: string;
  status: number;
  payload: {
    ok: false;
    error: string;
    request_id?: string;
    errors?: string[];
    details?: unknown;
  };
}) => {
  const payloadWithRequestId = {
    ...params.payload,
    request_id: params.request_id
  };

  return withRequestId(
    NextResponse.json(payloadWithRequestId, { status: params.status }),
    params.request_id
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

  return buildErrorResponse({
    request_id: params.request_id,
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
      return buildErrorResponse({
        request_id,
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
      return buildErrorResponse({
        request_id,
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

      return buildErrorResponse({
        request_id,
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
        return buildErrorResponse({
          request_id,
          status: 409,
          payload: {
            ok: false,
            error: "run_already_exists"
          }
        });
      }
      if (existingRun.reason !== "not_found") {
        return buildErrorResponse({
          request_id,
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
