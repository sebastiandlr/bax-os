import { createHash } from "node:crypto";
import type { BuildSpecV0 } from "@bax/buildspec";
import {
  CORE_FIELDS_COUNT_V0,
  CORE_FIELDS_V0,
  RADIOGRAPHY_RUNLOG_V0_VERSION,
  RadiographyRunLogV0Schema,
  type RadiographyOutputV0,
  type RadiographyRunLogV0,
  type ReasonCodeV0
} from "@bax/radiography-contract";

export const RUNLOG_RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;
export const FORBIDDEN_RUNLOG_KEY_NAMES = new Set(["path", "seed_urls_raw"]);
const FORBIDDEN_RUNLOG_STRING_PATTERNS = [/\/Users\//, /\.bax\/runlogs\//, /https?:\/\//i];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

export const extractSeedUrlsFromRunLogPayload = (runlogObject: Record<string, unknown>) => {
  const seedUrls: string[] = [];

  const topLevel = runlogObject.seed_urls_raw;
  if (Array.isArray(topLevel)) {
    for (const value of topLevel) {
      if (typeof value === "string") {
        seedUrls.push(value);
      }
    }
  }

  if (isRecord(runlogObject.inputs) && isRecord(runlogObject.inputs.seed_urls)) {
    const legacyUrls = runlogObject.inputs.seed_urls.urls;
    if (Array.isArray(legacyUrls)) {
      for (const value of legacyUrls) {
        if (typeof value === "string") {
          seedUrls.push(value);
        }
      }
    }
  }

  return seedUrls;
};

export const createRunId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sha256Hex = (input: string): string => {
  return createHash("sha256").update(input, "utf8").digest("hex");
};

export const normalizeSeedUrls = (seedUrlsRaw: string[]): string[] => {
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
      // Ignore invalid entries.
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
      // Ignore invalid entries.
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

export const summarizeSeedUrls = (seedUrlsRaw: string[]) => {
  const normalizedSeedUrls = normalizeSeedUrls(seedUrlsRaw);
  return {
    count: normalizedSeedUrls.length,
    unique_hosts: parseUniqueHosts(normalizedSeedUrls),
    url_hashes: normalizedSeedUrls.map((url) => sha256Hex(url)).sort()
  };
};

export const stripForbiddenRunLogKeys = (
  value: unknown,
  trail: string[] = []
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenRunLogKeys(item, trail));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (FORBIDDEN_RUNLOG_KEY_NAMES.has(key)) {
      continue;
    }

    if (trail.join(".") === "inputs.seed_urls" && key === "urls") {
      continue;
    }

    sanitized[key] = stripForbiddenRunLogKeys(childValue, [...trail, key]);
  }

  return sanitized;
};

const hasForbiddenRunLogContent = (
  value: unknown,
  trail: string[] = []
): boolean => {
  if (typeof value === "string") {
    return FORBIDDEN_RUNLOG_STRING_PATTERNS.some((pattern) => pattern.test(value));
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenRunLogContent(item, trail));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  for (const [key, childValue] of Object.entries(record)) {
    if (FORBIDDEN_RUNLOG_KEY_NAMES.has(key)) {
      return true;
    }

    if (trail.join(".") === "inputs.seed_urls" && key === "urls") {
      return true;
    }

    if (hasForbiddenRunLogContent(childValue, [...trail, key])) {
      return true;
    }
  }

  return false;
};

export const parseStoredRunLog = (value: unknown): RadiographyRunLogV0 | null => {
  if (hasForbiddenRunLogContent(value)) {
    return null;
  }

  const parsed = RadiographyRunLogV0Schema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
};

export const sanitizeRunLogForPersist = (
  runlogObject: Record<string, unknown>,
  seedUrlsRaw?: string[]
) => {
  const sanitized = stripForbiddenRunLogKeys(runlogObject);
  const runlogRecord = isRecord(sanitized) ? sanitized : {};

  const inputs = isRecord(runlogRecord.inputs) ? runlogRecord.inputs : {};
  const seedUrls = isRecord(inputs.seed_urls) ? inputs.seed_urls : {};

  const explicitSummary =
    seedUrlsRaw && seedUrlsRaw.length > 0 ? summarizeSeedUrls(seedUrlsRaw) : null;
  const existingCount =
    typeof seedUrls.count === "number" && Number.isFinite(seedUrls.count)
      ? Math.max(0, Math.floor(seedUrls.count))
      : 0;
  const fallbackHosts = normalizeHostTokens(seedUrls.unique_hosts);
  const fallbackHashes = normalizeExistingUrlHashes(seedUrls.url_hashes);

  inputs.seed_urls = explicitSummary ?? {
    count: existingCount,
    unique_hosts: fallbackHosts,
    url_hashes: fallbackHashes
  };

  runlogRecord.inputs = inputs;
  delete runlogRecord.errors;
  return runlogRecord;
};

export const buildRunLogDebug = (
  runlog: Pick<RadiographyRunLogV0, "outputs">
): RadiographyRunLogV0["debug"] => {
  const coreFieldsPresent = Math.max(
    0,
    Math.min(
      CORE_FIELDS_COUNT_V0,
      Math.round(
        (runlog.outputs.gating_decision.core_percent / 100) * CORE_FIELDS_COUNT_V0
      )
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

const getLintSummary = (output: RadiographyOutputV0) => {
  const hardCount = output.lint_report.filter((item) => item.severity === "hard_fail").length;
  const warnCount = output.lint_report.filter((item) => item.severity === "warn").length;
  const topReasonCodes: ReasonCodeV0[] = [];

  for (const finding of output.lint_report) {
    if (!topReasonCodes.includes(finding.reason_code)) {
      topReasonCodes.push(finding.reason_code);
    }
  }

  return {
    items_count: output.lint_report.length,
    hard_count: hardCount,
    warn_count: warnCount,
    top_reason_codes: topReasonCodes.slice(0, 10)
  };
};

export const buildRunLogFromRunnerOutput = (params: {
  output: RadiographyOutputV0;
  inputContext: {
    business_name: string;
    city: string;
    country: string;
    language: string;
    mode_hint: "lead" | "booking" | "quote";
  };
  buildspec: BuildSpecV0;
  seedUrlsRaw: string[];
  run_id?: string;
  created_at?: string;
}): RadiographyRunLogV0 => {
  const runlog: RadiographyRunLogV0 = {
    runlog_version: RADIOGRAPHY_RUNLOG_V0_VERSION,
    run_id: params.run_id ?? createRunId(),
    created_at: params.created_at ?? new Date().toISOString(),
    duration_ms: params.output.run_metadata.duration_ms,
    inputs: {
      contractVersion: "0.1.0",
      business_name: params.inputContext.business_name,
      city: params.inputContext.city,
      country: params.inputContext.country,
      language: params.inputContext.language,
      mode_hint: params.inputContext.mode_hint,
      seed_urls: summarizeSeedUrls(params.seedUrlsRaw)
    },
    buildspec: {
      schemaVersion: params.buildspec.schemaVersion,
      eventSchemaVersion: params.buildspec.eventSchemaVersion,
      mode: params.buildspec.mode,
      capabilities: params.buildspec.capabilities,
      metadata: params.buildspec.metadata
    },
    outputs: {
      gating_decision: params.output.gating_decision,
      lint_report: getLintSummary(params.output),
      patch_stats: {
        ops_count: params.output.business_dna_patch.length
      },
      provenance_coverage_percent: params.output.run_metadata.provenance_coverage_percent
    }
  };

  return {
    ...runlog,
    debug: buildRunLogDebug(runlog)
  };
};

const toUniqueSorted = (values: string[]) => {
  return [...new Set(values)].sort();
};

const diffStringLists = (fromValues: string[], toValues: string[]) => {
  const fromSet = new Set(fromValues);
  const toSet = new Set(toValues);

  return {
    added: [...toSet].filter((value) => !fromSet.has(value)).sort(),
    removed: [...fromSet].filter((value) => !toSet.has(value)).sort()
  };
};

export type RunLogDiff = {
  ok: true;
  from: string;
  to: string;
  changes: {
    gating: {
      from: RadiographyRunLogV0["outputs"]["gating_decision"];
      to: RadiographyRunLogV0["outputs"]["gating_decision"];
    };
    blockers: {
      added: string[];
      removed: string[];
    };
    patch_ops_count: {
      from: number;
      to: number;
      delta: number;
    };
    provenance_coverage_percent: {
      from: number;
      to: number;
      delta: number;
    };
    lint: {
      hard_delta: number;
      warn_delta: number;
      items_delta: number;
    };
    capabilities_changed: {
      added: string[];
      removed: string[];
    };
    seed_hosts_changed: {
      added: string[];
      removed: string[];
    };
  };
};

export const computeRunLogDiff = (
  fromRunlog: RadiographyRunLogV0,
  toRunlog: RadiographyRunLogV0
): RunLogDiff => {
  const fromBlockers = toUniqueSorted(
    fromRunlog.debug?.top_blockers ?? fromRunlog.outputs.gating_decision.reason_codes
  );
  const toBlockers = toUniqueSorted(
    toRunlog.debug?.top_blockers ?? toRunlog.outputs.gating_decision.reason_codes
  );

  return {
    ok: true,
    from: fromRunlog.run_id,
    to: toRunlog.run_id,
    changes: {
      gating: {
        from: fromRunlog.outputs.gating_decision,
        to: toRunlog.outputs.gating_decision
      },
      blockers: diffStringLists(fromBlockers, toBlockers),
      patch_ops_count: {
        from: fromRunlog.outputs.patch_stats.ops_count,
        to: toRunlog.outputs.patch_stats.ops_count,
        delta: toRunlog.outputs.patch_stats.ops_count - fromRunlog.outputs.patch_stats.ops_count
      },
      provenance_coverage_percent: {
        from: fromRunlog.outputs.provenance_coverage_percent,
        to: toRunlog.outputs.provenance_coverage_percent,
        delta:
          toRunlog.outputs.provenance_coverage_percent -
          fromRunlog.outputs.provenance_coverage_percent
      },
      lint: {
        hard_delta:
          toRunlog.outputs.lint_report.hard_count - fromRunlog.outputs.lint_report.hard_count,
        warn_delta:
          toRunlog.outputs.lint_report.warn_count - fromRunlog.outputs.lint_report.warn_count,
        items_delta:
          toRunlog.outputs.lint_report.items_count - fromRunlog.outputs.lint_report.items_count
      },
      capabilities_changed: diffStringLists(
        fromRunlog.buildspec.capabilities,
        toRunlog.buildspec.capabilities
      ),
      seed_hosts_changed: diffStringLists(
        fromRunlog.inputs.seed_urls.unique_hosts,
        toRunlog.inputs.seed_urls.unique_hosts
      )
    }
  };
};
