import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CORE_FIELDS_COUNT_V0,
  CORE_FIELDS_V0,
  RadiographyRunLogV0Schema,
  type RadiographyRunLogV0,
  type ReasonCodeV0
} from "@bax/radiography-contract";
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

const LEGACY_SEED_URLS_PAYLOAD_SCHEMA = z
  .object({
    inputs: z
      .object({
        seed_urls: z
          .object({
            urls: z.array(z.string()).optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    seed_urls_raw: z.array(z.string()).optional()
  })
  .passthrough();

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const normalizeSeedUrls = (seedUrlsRaw: string[]): string[] => {
  const normalized: string[] = [];
  for (const seedUrlRaw of seedUrlsRaw) {
    const trimmed = seedUrlRaw.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      normalized.push(parsed.toString());
    } catch {
      // Ignore invalid URLs while building runlog summaries.
    }
  }
  return normalized;
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

const normalizeHostTokens = (hostsInput: unknown): string[] => {
  if (!Array.isArray(hostsInput)) {
    return [];
  }

  const hosts = new Set<string>();
  for (const value of hostsInput) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    let normalizedHost = "";
    try {
      normalizedHost = new URL(trimmed).hostname.trim().toLowerCase();
    } catch {
      try {
        normalizedHost = new URL(`https://${trimmed}`).hostname.trim().toLowerCase();
      } catch {
        normalizedHost = "";
      }
    }

    if (normalizedHost) {
      hosts.add(normalizedHost);
    }
  }

  return [...hosts].sort();
};

const normalizeExistingUrlHashes = (hashesInput: unknown): string[] => {
  if (!Array.isArray(hashesInput)) {
    return [];
  }

  return hashesInput
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[a-f0-9]{64}$/.test(value))
    .sort();
};

const stripForbiddenKeys = (
  value: unknown,
  trail: string[] = []
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenKeys(item, trail));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (key === "path" || key === "seed_urls_raw") {
      continue;
    }

    if (trail.join(".") === "inputs.seed_urls" && key === "urls") {
      continue;
    }

    sanitized[key] = stripForbiddenKeys(childValue, [...trail, key]);
  }

  return sanitized;
};

const extractRawSeedUrls = (
  runlogObject: Record<string, unknown>,
  providedRawUrls?: string[]
): string[] => {
  const rawSeedUrls: string[] = [];
  if (Array.isArray(providedRawUrls)) {
    rawSeedUrls.push(...providedRawUrls);
  }

  const legacy = LEGACY_SEED_URLS_PAYLOAD_SCHEMA.safeParse(runlogObject);
  if (legacy.success) {
    if (legacy.data.seed_urls_raw) {
      rawSeedUrls.push(...legacy.data.seed_urls_raw);
    }

    if (legacy.data.inputs?.seed_urls?.urls) {
      rawSeedUrls.push(...legacy.data.inputs.seed_urls.urls);
    }
  }

  return rawSeedUrls;
};

const patchSeedUrlSummary = (
  runlogObject: Record<string, unknown>,
  seedUrlsRaw?: string[]
) => {
  const normalizedSeedUrls = normalizeSeedUrls(extractRawSeedUrls(runlogObject, seedUrlsRaw));
  const sanitizedRunlog = stripForbiddenKeys(runlogObject);
  const runlogRecord = isRecord(sanitizedRunlog) ? sanitizedRunlog : {};

  const inputs = isRecord(runlogRecord.inputs) ? runlogRecord.inputs : {};
  const seedUrls = isRecord(inputs.seed_urls) ? inputs.seed_urls : {};

  const existingCount =
    typeof seedUrls.count === "number" && Number.isFinite(seedUrls.count)
      ? Math.max(0, Math.floor(seedUrls.count))
      : 0;

  const fallbackHosts = normalizeHostTokens(seedUrls.unique_hosts);
  const fallbackHashes = normalizeExistingUrlHashes(seedUrls.url_hashes);

  const uniqueHosts =
    normalizedSeedUrls.length > 0 ? parseUniqueHosts(normalizedSeedUrls) : fallbackHosts;
  const urlHashes =
    normalizedSeedUrls.length > 0
      ? normalizedSeedUrls.map((url) => sha256Hex(url)).sort()
      : fallbackHashes;
  const count = normalizedSeedUrls.length > 0 ? normalizedSeedUrls.length : existingCount;

  inputs.seed_urls = {
    count,
    unique_hosts: uniqueHosts,
    url_hashes: urlHashes
  };

  runlogRecord.inputs = inputs;
  delete runlogRecord.errors;
  return runlogRecord;
};

const buildRunLogDebug = (
  runlog: RadiographyRunLogV0
): RadiographyRunLogV0["debug"] => {
  const coreFieldsPresent = Math.max(
    0,
    Math.min(
      CORE_FIELDS_COUNT_V0,
      Math.round((runlog.outputs.gating_decision.core_percent / 100) * CORE_FIELDS_COUNT_V0)
    )
  );

  const topMissingCoreFields = CORE_FIELDS_V0.slice(coreFieldsPresent, coreFieldsPresent + 10);

  const topBlockers = [...runlog.outputs.gating_decision.reason_codes];
  for (const reasonCode of runlog.outputs.lint_report.top_reason_codes) {
    if (!topBlockers.includes(reasonCode)) {
      topBlockers.push(reasonCode);
    }
  }

  const normalizedTopBlockers = topBlockers.slice(0, 10) as ReasonCodeV0[];
  const publishBlockersPresent = normalizedTopBlockers.includes("unverified_publish_blocker")
    ? 0
    : 1;

  return {
    core_fields_present: coreFieldsPresent,
    publish_blockers_present: publishBlockersPresent,
    top_missing_core_fields: topMissingCoreFields,
    top_blockers: normalizedTopBlockers
  };
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
      unique_hosts_count: item.unique_hosts_count,
      top_blockers: item.top_blockers
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

  if (!isRecord(parsedBody.data.runlog)) {
    return NextResponse.json(
      { ok: false, errors: ["runlog: must be an object"] },
      { status: 400 }
    );
  }

  const runlogObject = patchSeedUrlSummary(parsedBody.data.runlog, parsedBody.data.seed_urls_raw);
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
    return NextResponse.json(
      { ok: false, errors: formatIssues(parsed.error.issues) },
      { status: 400 }
    );
  }

  const hardenedRunlog: RadiographyRunLogV0 = {
    ...parsed.data,
    debug: buildRunLogDebug(parsed.data)
  };

  await writeRunLog(hardenedRunlog);
  return NextResponse.json({ ok: true, run_id: hardenedRunlog.run_id });
}
