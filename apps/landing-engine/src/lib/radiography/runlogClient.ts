import {
  EvidenceReplayErrorResponseV0Schema,
  type EvidenceReplayErrorResponseV0,
  RunlogErrorResponseV0Schema,
  type RunlogErrorResponseV0
} from "@bax/radiography-contract";

type RequestIdPair = {
  header?: string;
  body?: string;
  correlated: boolean;
};

export type RunlogApiError = {
  ok: false;
  error: string;
  request_id?: string;
  x_request_id?: string;
  errors?: string[];
  details?: unknown;
  status: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const extractRequestIds = (response: Response, body: unknown): RequestIdPair => {
  const headerValue = response.headers.get("x-request-id");
  const header = typeof headerValue === "string" && headerValue.length > 0 ? headerValue : undefined;

  const bodyValue =
    isRecord(body) && typeof body.request_id === "string" && body.request_id.length > 0
      ? body.request_id
      : undefined;

  return {
    ...(header ? { header } : {}),
    ...(bodyValue ? { body: bodyValue } : {}),
    correlated: header !== undefined && bodyValue !== undefined && header === bodyValue
  };
};

export const parseRunlogError = (body: unknown): RunlogErrorResponseV0 | null => {
  const parsed = RunlogErrorResponseV0Schema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

export const parseReplayError = (body: unknown): EvidenceReplayErrorResponseV0 | null => {
  const parsed = EvidenceReplayErrorResponseV0Schema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

export const normalizeRunlogResponse = <T>(
  response: Response,
  body: unknown,
  opts?: { mode?: "runlog" | "replay" }
): { ok: true; data: T } | RunlogApiError => {
  if (response.ok) {
    return { ok: true, data: body as T };
  }

  const replayParsed = opts?.mode === "replay" ? parseReplayError(body) : null;
  const runlogParsed = parseRunlogError(body);
  const parsedError = replayParsed ?? runlogParsed;
  const ids = extractRequestIds(response, body);

  const errorFromBody =
    isRecord(body) && typeof body.error === "string" && body.error.length > 0 ? body.error : undefined;
  const errorsFromBody =
    isRecord(body) && Array.isArray(body.errors) && body.errors.every((value) => typeof value === "string")
      ? (body.errors as string[])
      : undefined;
  const detailsFromBody = isRecord(body) && "details" in body ? body.details : undefined;
  const detailsValue = parsedError?.details ?? detailsFromBody;
  const errorsValue = parsedError?.errors ?? errorsFromBody;

  const normalizedError: RunlogApiError = {
    ok: false,
    status: response.status,
    error: parsedError?.error ?? errorFromBody ?? "error",
    ...(ids.body ? { request_id: ids.body } : {}),
    ...(ids.header ? { x_request_id: ids.header } : {}),
    ...(errorsValue ? { errors: errorsValue } : {}),
    ...(detailsValue !== undefined ? { details: detailsValue } : {})
  };

  return normalizedError;
};
