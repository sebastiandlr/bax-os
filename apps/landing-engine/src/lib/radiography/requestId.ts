import { NextResponse } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const REQUEST_ID_FALLBACK_SANITIZE_PATTERN = /[^a-z0-9-]/g;

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

export const buildErrorResponse = (params: {
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

  return withRequestId(
    NextResponse.json(payloadWithRequestId, { status: params.status }),
    params.requestId
  );
};
