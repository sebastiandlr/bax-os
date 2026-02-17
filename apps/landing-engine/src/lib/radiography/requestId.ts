import { NextResponse } from "next/server";
import { RunlogErrorResponseV0Schema } from "@bax/radiography-contract";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const REQUEST_ID_FALLBACK_SANITIZE_PATTERN = /[^a-z0-9-]/g;
const CONTRACT_ISSUES_PATH_ALLOWLIST = new Set([
  "root",
  "ok",
  "error",
  "request_id",
  "errors",
  "details"
]);

const isRunlogContractValidationEnabled = () => {
  return process.env.NODE_ENV !== "production" || process.env.BAX_CONTRACT_ASSERTS === "1";
};

const shouldThrowOnRunlogContractViolation = () => process.env.BAX_CONTRACT_ASSERTS === "1";

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

export const getRequestId = (request: Request) => {
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

export const withRequestId = <T extends Response>(response: T, requestId: string): T => {
  response.headers.set("x-request-id", requestId);
  return response;
};

const projectRunlogErrorEnvelope = (payload: {
  ok: false;
  error: string;
  request_id: string;
  errors?: string[];
  details?: unknown;
}) => {
  return {
    ok: payload.ok,
    error: payload.error,
    request_id: payload.request_id,
    ...(payload.errors !== undefined ? { errors: payload.errors } : {}),
    ...(payload.details !== undefined ? { details: payload.details } : {})
  };
};

const sanitizeContractIssuePaths = (issues: { path: PropertyKey[] }[]) => {
  const topLevelPaths = new Set<string>();

  for (const issue of issues) {
    if (issue.path.length === 0) {
      topLevelPaths.add("root");
      continue;
    }

    const firstSegment = issue.path[0];
    if (typeof firstSegment === "string" && CONTRACT_ISSUES_PATH_ALLOWLIST.has(firstSegment)) {
      topLevelPaths.add(firstSegment);
      continue;
    }

    topLevelPaths.add("root");
  }

  return [...topLevelPaths].sort((a, b) => a.localeCompare(b));
};

export const assertRunlogErrorEnvelope = (
  payload: unknown,
  options?: { routeTag?: string }
) => {
  if (!isRunlogContractValidationEnabled()) {
    return;
  }

  const parsed = RunlogErrorResponseV0Schema.safeParse(payload);
  if (parsed.success) {
    return;
  }

  const issues_paths = sanitizeContractIssuePaths(parsed.error.issues);

  console.error("radiography_contract_violation", {
    ...(options?.routeTag ? { route_tag: options.routeTag } : {}),
    error: "contract_violation",
    issues_count: parsed.error.issues.length,
    issues_paths
  });

  if (shouldThrowOnRunlogContractViolation()) {
    throw new Error("contract_violation");
  }
};

export const buildErrorResponse = (params: {
  requestId: string;
  status: number;
  routeTag?: string;
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

  assertRunlogErrorEnvelope(projectRunlogErrorEnvelope(payloadWithRequestId), {
    routeTag: params.routeTag
  });

  return withRequestId(
    NextResponse.json(payloadWithRequestId, { status: params.status }),
    params.requestId
  );
};
