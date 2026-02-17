import { NextResponse } from "next/server";
import { z } from "zod";
import {
  RadiographyRunLogV0Schema
} from "@bax/radiography-contract";
import { listRunLogs, writeRunLog } from "@/lib/radiography/runlogStorage";
import {
  createRunId,
  deriveRunLogServerFields,
  extractSeedUrlsFromRunLogPayload,
  sanitizeRunLogForPersist
} from "@/lib/radiography/runlogUtils";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

const formatIssues = (
  issues: { path: PropertyKey[]; message: string }[]
) => {
  return issues.map((issue) => {
    const path =
      issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join(".") : "root";
    return `${path}: ${issue.message}`;
  });
};

const RunlogPostBodySchema = z
  .object({
    runlog: z.unknown(),
    seed_urls_raw: z.array(z.string()).optional()
  })
  .strict();

const parseListLimit = (value: string | null): number => {
  if (!value) {
    return 20;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseListLimit(searchParams.get("limit"));
    const items = (await listRunLogs(limit)).map((item) => ({
      run_id: item.run_id,
      created_at: item.created_at,
      duration_ms: item.duration_ms,
      status: item.status,
      core_percent: item.core_percent,
      reason_codes: item.reason_codes,
      seed_urls_count: item.seed_urls_count,
      unique_hosts_count: item.unique_hosts_count,
      source: item.source,
      is_stub: item.is_stub,
      top_blockers: item.top_blockers
    }));
    return withRequestId(NextResponse.json({ ok: true, items }), requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list runlogs";
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error", message }
    });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return buildErrorResponse({
      requestId,
      status: 400,
      payload: {
        ok: false,
        error: "invalid",
        errors: ["runlog: request body must be valid JSON"]
      }
    });
  }

  const parsedBody = RunlogPostBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return buildErrorResponse({
      requestId,
      status: 400,
      payload: { ok: false, error: "invalid", errors: formatIssues(parsedBody.error.issues) }
    });
  }

  if (!isRecord(parsedBody.data.runlog)) {
    return buildErrorResponse({
      requestId,
      status: 400,
      payload: { ok: false, error: "invalid", errors: ["runlog: must be an object"] }
    });
  }

  const allSeedUrls = [
    ...(parsedBody.data.seed_urls_raw ?? []),
    ...extractSeedUrlsFromRunLogPayload(parsedBody.data.runlog)
  ];

  const runlogObject = sanitizeRunLogForPersist(parsedBody.data.runlog, allSeedUrls);
  if (typeof runlogObject.run_id !== "string" || runlogObject.run_id.length === 0) {
    runlogObject.run_id = createRunId();
  }

  if (
    typeof runlogObject.created_at !== "string" ||
    Number.isNaN(Date.parse(runlogObject.created_at))
  ) {
    runlogObject.created_at = new Date().toISOString();
  }

  const parsed = RadiographyRunLogV0Schema.safeParse(runlogObject);

  if (!parsed.success) {
    return buildErrorResponse({
      requestId,
      status: 400,
      payload: { ok: false, error: "invalid", errors: formatIssues(parsed.error.issues) }
    });
  }

  const hardenedRunlog = deriveRunLogServerFields(parsed.data);

  await writeRunLog(hardenedRunlog);
  return withRequestId(NextResponse.json({ ok: true, run_id: hardenedRunlog.run_id }), requestId);
}
