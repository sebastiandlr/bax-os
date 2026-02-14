import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RadiographyRunLogV0Schema } from "@bax/radiography-contract";
import { listRunLogs, writeRunLog } from "@/lib/radiography/runlogStorage";

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

const sha256Hex = (input: string): string => {
  return createHash("sha256").update(input, "utf8").digest("hex");
};

const createRunId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

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

const normalizeSeedUrls = (seedUrlsRaw: string[]): string[] => {
  return seedUrlsRaw.map((url) => url.trim()).filter((url) => url.length > 0);
};

const parseUniqueHosts = (seedUrls: string[]): string[] => {
  const hosts = new Set<string>();
  for (const seedUrl of seedUrls) {
    try {
      const hostname = new URL(seedUrl).hostname.trim().toLowerCase();
      if (hostname.length > 0) {
        hosts.add(hostname);
      }
    } catch {
      // Ignore invalid URLs while building host summary.
    }
  }
  return [...hosts].sort();
};

export async function GET(request: Request) {
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
      unique_hosts_count: item.unique_hosts_count
    }));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list runlogs";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["runlog: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  const parsedBody = RunlogPostBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, errors: formatIssues(parsedBody.error.issues) },
      { status: 400 }
    );
  }

  const runlogCandidate =
    parsedBody.data.runlog && typeof parsedBody.data.runlog === "object"
      ? {
          ...(parsedBody.data.runlog as Record<string, unknown>)
        }
      : parsedBody.data.runlog;

  if (
    runlogCandidate &&
    typeof runlogCandidate === "object" &&
    parsedBody.data.seed_urls_raw &&
    Array.isArray(parsedBody.data.seed_urls_raw)
  ) {
    const normalizedSeedUrls = normalizeSeedUrls(parsedBody.data.seed_urls_raw);
    const uniqueHosts = parseUniqueHosts(normalizedSeedUrls);
    const urlHashes = normalizedSeedUrls.map((url) => sha256Hex(url)).sort();

    const runlogObject = runlogCandidate as Record<string, unknown>;
    const inputs =
      runlogObject.inputs && typeof runlogObject.inputs === "object"
        ? { ...(runlogObject.inputs as Record<string, unknown>) }
        : {};

    inputs.seed_urls = {
      count: normalizedSeedUrls.length,
      unique_hosts: uniqueHosts,
      url_hashes: urlHashes
    };

    if (typeof runlogObject.run_id !== "string" || runlogObject.run_id.length === 0) {
      runlogObject.run_id = createRunId();
    }
    if (
      typeof runlogObject.created_at !== "string" ||
      Number.isNaN(Date.parse(runlogObject.created_at))
    ) {
      runlogObject.created_at = new Date().toISOString();
    }

    runlogObject.inputs = inputs;
  }

  const parsed = RadiographyRunLogV0Schema.safeParse(runlogCandidate);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: formatIssues(parsed.error.issues) },
      { status: 400 }
    );
  }

  await writeRunLog(parsed.data);
  return NextResponse.json({ ok: true, run_id: parsed.data.run_id });
}
