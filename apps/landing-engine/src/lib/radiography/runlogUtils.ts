import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { BuildSpecV0 } from "@bax/buildspec";
import { z } from "zod";
import {
  CORE_FIELDS_COUNT_V0,
  CORE_FIELDS_V0,
  RADIOGRAPHY_RUNLOG_V0_VERSION,
  ReasonCodeV0Enum,
  RadiographyRunLogV0Schema,
  type DecisionTraceEntryV0,
  type RadiographyOutputV0,
  type RadiographyRunLogV0,
  type ReasonCodeV0
} from "@bax/radiography-contract";
import { detectLandingEngineRoot } from "../spec/buildspecStorage";

export const RUNLOG_RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;
export const EVIDENCE_ARTIFACT_ID_PATTERN = /^[a-zA-Z0-9_-]{3,120}$/;
export const EVIDENCE_BUNDLE_V0_VERSION = "0.1.0" as const;
export const EVIDENCE_BUNDLE_LIMITS = {
  maxArtifacts: 200,
  maxTotalBytes: 5_000_000,
  maxSingleArtifactBytes: 512_000
} as const;
export const FORBIDDEN_RUNLOG_KEY_NAMES = new Set(["path", "seed_urls_raw"]);
const FORBIDDEN_RUNLOG_STRING_PATTERNS = [
  /\/Users\//,
  /\\Users\\/,
  /\.bax\/runlogs\//,
  /https?:\/\//i
];

const EVIDENCE_DIR = process.env.BAX_EVIDENCE_DIR
  ? path.resolve(process.env.BAX_EVIDENCE_DIR)
  : path.join(detectLandingEngineRoot(), ".bax", "evidence");
const RESOLVED_EVIDENCE_DIR = path.resolve(EVIDENCE_DIR);
const RUNLOG_DIR = process.env.BAX_RUNLOG_DIR
  ? path.resolve(process.env.BAX_RUNLOG_DIR)
  : path.join(detectLandingEngineRoot(), ".bax", "runlogs");
const RESOLVED_RUNLOG_DIR = path.resolve(RUNLOG_DIR);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const toPrettyJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const isPathInsideDir = (rootDir: string, targetPath: string) => {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

const ensureRunId = (run_id: string) => {
  if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
    throw new Error("invalid run_id");
  }
};

const toUnique = <T>(items: T[]) => [...new Set(items)];

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

const redactForbiddenArtifactContent = (value: unknown, trail: string[] = []): unknown => {
  if (typeof value === "string") {
    return FORBIDDEN_RUNLOG_STRING_PATTERNS.some((pattern) => pattern.test(value))
      ? "[REDACTED]"
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForbiddenArtifactContent(item, trail));
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

    sanitized[key] = redactForbiddenArtifactContent(childValue, [...trail, key]);
  }

  return sanitized;
};

const sanitizeArtifactJsonContent = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const sanitized = redactForbiddenArtifactContent(value);
  if (!isRecord(sanitized)) {
    return null;
  }

  if (hasForbiddenRunLogContent(sanitized)) {
    return null;
  }

  return sanitized;
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
  delete runlogRecord.debug;
  delete runlogRecord.decision_trace;
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

const TRACE_MESSAGE_BY_CODE: Record<string, string> = {
  needs_manual_verify: "Manual verification is required before publishing.",
  unknown_field: "One or more required fields are still unknown.",
  unverified_publish_blocker:
    "Publish-blocker fields remain hidden until they are verified.",
  missing_provenance: "Missing provenance detected for one or more values.",
  language_not_supported: "Language is outside the supported deterministic allowlist.",
  insufficient_core_coverage: "Core field coverage is below the publish threshold.",
  conflict_detected: "Conflicting evidence was detected and needs manual resolution.",
  lint_violation: "Lint policy violation detected in radiography output.",
  missing_seed_url: "At least one seed URL is required to run radiography.",
  gating_pass: "Gating status is pass.",
  gating_soft_fail: "Gating status is soft_fail.",
  gating_hard_fail: "Gating status is hard_fail."
};

const BLOCKER_REASON_CODES = new Set<ReasonCodeV0>([
  "unverified_publish_blocker",
  "conflict_detected",
  "insufficient_core_coverage",
  "lint_violation"
]);

const severityRank = {
  blocker: 0,
  warn: 1,
  info: 2
} as const;

export type EvidenceArtifactV0 = {
  id: string;
  kind: "inputs_summary" | "gating" | "debug";
  sha256: string;
  bytes: number;
  created_at: string;
};

export type EvidenceIndexV0 = {
  run_id: string;
  created_at: string;
  artifacts: EvidenceArtifactV0[];
};

export const EvidenceArtifactV0Schema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["inputs_summary", "gating", "debug"]),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative(),
    created_at: z.string().datetime()
  })
  .strict();

export const EvidenceIndexV0Schema = z
  .object({
    run_id: z.string().regex(RUNLOG_RUN_ID_PATTERN),
    created_at: z.string().datetime(),
    artifacts: z.array(EvidenceArtifactV0Schema)
  })
  .strict();

export type EvidenceBundleArtifactV0 = EvidenceArtifactV0 & {
  content: unknown;
};

export type EvidenceBundleV0 = {
  bundle_version: typeof EVIDENCE_BUNDLE_V0_VERSION;
  run_id: string;
  created_at: string;
  evidence_index: EvidenceIndexV0;
  artifacts: EvidenceBundleArtifactV0[];
};

export const EvidenceBundleArtifactV0Schema = EvidenceArtifactV0Schema.extend({
  content: z.unknown()
}).strict();

export const EvidenceBundleV0Schema = z
  .object({
    bundle_version: z.literal(EVIDENCE_BUNDLE_V0_VERSION),
    run_id: z.string().regex(RUNLOG_RUN_ID_PATTERN),
    created_at: z.string().datetime(),
    evidence_index: EvidenceIndexV0Schema,
    artifacts: z.array(EvidenceBundleArtifactV0Schema)
  })
  .strict();

type EvidenceArtifactDraft = EvidenceArtifactV0 & {
  content: string;
};

const buildEvidenceArtifacts = (runlog: RadiographyRunLogV0): EvidenceArtifactDraft[] => {
  const artifacts: EvidenceArtifactDraft[] = [];

  const definitions: Array<{
    kind: EvidenceArtifactV0["kind"];
    value: unknown;
  }> = [
    {
      kind: "inputs_summary",
      value: {
        business_name: runlog.inputs.business_name,
        city: runlog.inputs.city,
        country: runlog.inputs.country,
        language: runlog.inputs.language,
        mode_hint: runlog.inputs.mode_hint,
        seed_urls: runlog.inputs.seed_urls
      }
    },
    {
      kind: "gating",
      value: runlog.outputs.gating_decision
    }
  ];

  if (runlog.debug) {
    definitions.push({ kind: "debug", value: runlog.debug });
  }

  for (const definition of definitions) {
    const content = toPrettyJson(definition.value);
    const sha = sha256Hex(content);
    artifacts.push({
      id: `${definition.kind}-${sha.slice(0, 8)}`,
      kind: definition.kind,
      sha256: sha,
      bytes: Buffer.byteLength(content, "utf8"),
      created_at: runlog.created_at,
      content
    });
  }

  return artifacts;
};

const buildEvidenceRefMap = (artifacts: EvidenceArtifactV0[]) => {
  const refs: Partial<Record<EvidenceArtifactV0["kind"], string>> = {};
  for (const artifact of artifacts) {
    refs[artifact.kind] = `evidence:${artifact.id}`;
  }
  return refs;
};

const toReasonCodes = (runlog: RadiographyRunLogV0): ReasonCodeV0[] => {
  return toUnique<ReasonCodeV0>([
    ...runlog.outputs.gating_decision.reason_codes,
    ...runlog.outputs.lint_report.top_reason_codes,
    ...(runlog.debug?.top_blockers ?? [])
  ]);
};

export const buildDecisionTraceEntries = (
  runlog: RadiographyRunLogV0,
  evidenceArtifacts: EvidenceArtifactV0[] = []
): DecisionTraceEntryV0[] => {
  const evidenceRefs = buildEvidenceRefMap(evidenceArtifacts);
  const codes = toReasonCodes(runlog);
  const trace: DecisionTraceEntryV0[] = [];

  const gatingCode = `gating_${runlog.outputs.gating_decision.status}`;
  trace.push({
    code: gatingCode,
    severity: "info",
    message: TRACE_MESSAGE_BY_CODE[gatingCode] ?? `Gating status is ${runlog.outputs.gating_decision.status}.`,
    evidence_refs: evidenceRefs.gating ? [evidenceRefs.gating] : undefined
  });

  for (const code of codes) {
    const isBlocker =
      (runlog.debug?.top_blockers ?? []).includes(code) ||
      BLOCKER_REASON_CODES.has(code) ||
      (runlog.outputs.gating_decision.status === "hard_fail" &&
        runlog.outputs.gating_decision.reason_codes.includes(code));

    const refs = toUnique(
      [
        evidenceRefs.gating,
        evidenceRefs.debug,
        code === "missing_seed_url" ? evidenceRefs.inputs_summary : undefined
      ].filter((value): value is string => Boolean(value))
    );

    trace.push({
      code,
      severity: isBlocker ? "blocker" : "warn",
      message: TRACE_MESSAGE_BY_CODE[code] ?? `Review required for decision code: ${code}.`,
      evidence_refs: refs.length > 0 ? refs : undefined
    });
  }

  return trace.sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return a.code.localeCompare(b.code);
  });
};

export const deriveRunLogServerFields = (runlog: RadiographyRunLogV0): RadiographyRunLogV0 => {
  const baseRunlog: RadiographyRunLogV0 = {
    ...runlog,
    debug: buildRunLogDebug(runlog)
  };

  const artifacts = buildEvidenceArtifacts(baseRunlog);
  return {
    ...baseRunlog,
    decision_trace: buildDecisionTraceEntries(baseRunlog, artifacts)
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

  return deriveRunLogServerFields(runlog);
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

const getEvidenceDirForRun = (run_id: string) => {
  ensureRunId(run_id);
  const evidenceRunDir = path.join(EVIDENCE_DIR, run_id);
  if (!isPathInsideDir(RESOLVED_EVIDENCE_DIR, evidenceRunDir)) {
    throw new Error("invalid evidence path");
  }
  return evidenceRunDir;
};

const ensureEvidenceDir = async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
};

const ensureRunLogDir = async () => {
  await mkdir(RUNLOG_DIR, { recursive: true });
};

const getRunLogPath = (run_id: string) => {
  ensureRunId(run_id);
  const runlogPath = path.join(RUNLOG_DIR, `${run_id}.json`);
  if (!isPathInsideDir(RESOLVED_RUNLOG_DIR, runlogPath)) {
    throw new Error("invalid runlog path");
  }
  return runlogPath;
};

export const writeEvidencePackForRunLog = async (
  runlog: RadiographyRunLogV0
): Promise<EvidenceIndexV0> => {
  ensureRunId(runlog.run_id);
  await ensureEvidenceDir();

  const evidenceRunDir = getEvidenceDirForRun(runlog.run_id);
  await mkdir(evidenceRunDir, { recursive: true });

  const drafts = buildEvidenceArtifacts(runlog);
  const artifacts: EvidenceArtifactV0[] = drafts.map((draft) => ({
    id: draft.id,
    kind: draft.kind,
    sha256: draft.sha256,
    bytes: draft.bytes,
    created_at: draft.created_at
  }));

  for (const draft of drafts) {
    const artifactFilePath = path.join(evidenceRunDir, `${draft.id}.json`);
    if (!isPathInsideDir(evidenceRunDir, artifactFilePath)) {
      throw new Error("invalid artifact path");
    }
    await writeFile(artifactFilePath, draft.content, "utf8");
  }

  const index: EvidenceIndexV0 = {
    run_id: runlog.run_id,
    created_at: runlog.created_at,
    artifacts
  };

  const indexPath = path.join(evidenceRunDir, "index.json");
  if (!isPathInsideDir(evidenceRunDir, indexPath)) {
    throw new Error("invalid evidence index path");
  }
  await writeFile(indexPath, toPrettyJson(index), "utf8");

  return index;
};

export const readEvidenceIndexByRunId = async (
  run_id: string
): Promise<
  | { ok: true; evidence_index: EvidenceIndexV0 }
  | { ok: false; reason: "not_found" | "invalid" }
> => {
  if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
    return { ok: false, reason: "invalid" };
  }

  const evidenceRunDir = getEvidenceDirForRun(run_id);
  const indexPath = path.join(evidenceRunDir, "index.json");

  let indexText: string;
  try {
    indexText = await readFile(indexPath, "utf8");
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { ok: false, reason: "not_found" };
    }
    return { ok: false, reason: "invalid" };
  }

  try {
    const parsed = JSON.parse(indexText) as unknown;
    if (hasForbiddenRunLogContent(parsed)) {
      return { ok: false, reason: "invalid" };
    }

    const validated = EvidenceIndexV0Schema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, reason: "invalid" };
    }

    return { ok: true, evidence_index: validated.data };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};

type ReadEvidenceArtifactResult =
  | {
      ok: true;
      artifact: EvidenceArtifactV0 & {
        content: Record<string, unknown>;
      };
    }
  | {
      ok: false;
      error: "invalid" | "not_found" | "integrity_mismatch" | "artifact_not_json";
    };

export const readEvidenceArtifactById = async (
  run_id: string,
  artifact_id: string
): Promise<ReadEvidenceArtifactResult> => {
  if (!RUNLOG_RUN_ID_PATTERN.test(run_id) || !EVIDENCE_ARTIFACT_ID_PATTERN.test(artifact_id)) {
    return { ok: false, error: "invalid" };
  }

  const indexResult = await readEvidenceIndexByRunId(run_id);
  if (!indexResult.ok) {
    return {
      ok: false,
      error: indexResult.reason === "not_found" ? "not_found" : "invalid"
    };
  }

  const metadata = indexResult.evidence_index.artifacts.find((artifact) => artifact.id === artifact_id);
  if (!metadata) {
    return { ok: false, error: "not_found" };
  }

  if (!artifact_id.startsWith(`${metadata.kind}-`)) {
    return { ok: false, error: "integrity_mismatch" };
  }

  const evidenceRunDir = getEvidenceDirForRun(run_id);
  const artifactPath = path.join(evidenceRunDir, `${artifact_id}.json`);
  if (!isPathInsideDir(evidenceRunDir, artifactPath)) {
    return { ok: false, error: "invalid" };
  }

  let artifactText: string;
  try {
    artifactText = await readFile(artifactPath, "utf8");
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { ok: false, error: "not_found" };
    }
    return { ok: false, error: "invalid" };
  }

  const computedSha = sha256Hex(artifactText);
  const computedBytes = Buffer.byteLength(artifactText, "utf8");

  if (computedSha !== metadata.sha256 || computedBytes !== metadata.bytes) {
    return { ok: false, error: "integrity_mismatch" };
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(artifactText) as unknown;
  } catch {
    return { ok: false, error: "artifact_not_json" };
  }

  const sanitizedContent = sanitizeArtifactJsonContent(parsedContent);
  if (!sanitizedContent) {
    return { ok: false, error: "artifact_not_json" };
  }

  return {
    ok: true,
    artifact: {
      ...metadata,
      content: sanitizedContent
    }
  };
};

type EvidenceBundleError =
  | "invalid"
  | "not_found"
  | "integrity_mismatch"
  | "artifact_not_json"
  | "bundle_too_large"
  | "run_already_exists";

type EvidenceBundleFailure = {
  ok: false;
  error: EvidenceBundleError;
  artifact_id?: string;
};

type EvidenceBundleSuccess = {
  ok: true;
  bundle: EvidenceBundleV0;
};

type BundleDraftArtifact = {
  metadata: EvidenceArtifactV0;
  contentText: string;
};

const validateBundleCaps = (
  artifacts: Array<Pick<EvidenceArtifactV0, "bytes">>
): { ok: true } | EvidenceBundleFailure => {
  if (artifacts.length > EVIDENCE_BUNDLE_LIMITS.maxArtifacts) {
    return { ok: false, error: "bundle_too_large" };
  }

  let totalBytes = 0;
  for (const artifact of artifacts) {
    if (artifact.bytes > EVIDENCE_BUNDLE_LIMITS.maxSingleArtifactBytes) {
      return { ok: false, error: "bundle_too_large" };
    }
    totalBytes += artifact.bytes;
    if (totalBytes > EVIDENCE_BUNDLE_LIMITS.maxTotalBytes) {
      return { ok: false, error: "bundle_too_large" };
    }
  }

  return { ok: true };
};

const assertArtifactIdsUnique = (
  artifacts: Array<Pick<EvidenceArtifactV0, "id">>
): { ok: true } | EvidenceBundleFailure => {
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    if (seen.has(artifact.id)) {
      return { ok: false, error: "invalid", artifact_id: artifact.id };
    }
    seen.add(artifact.id);
  }
  return { ok: true };
};

const buildBundleDraftArtifacts = (
  bundle: EvidenceBundleV0
): { ok: true; drafts: BundleDraftArtifact[] } | EvidenceBundleFailure => {
  if (
    bundle.evidence_index.run_id !== bundle.run_id ||
    bundle.evidence_index.created_at !== bundle.created_at
  ) {
    return { ok: false, error: "invalid" };
  }

  if (bundle.evidence_index.artifacts.length !== bundle.artifacts.length) {
    return { ok: false, error: "invalid" };
  }

  const capsResult = validateBundleCaps(bundle.evidence_index.artifacts);
  if (!capsResult.ok) {
    return capsResult;
  }

  const uniqueIndexResult = assertArtifactIdsUnique(bundle.evidence_index.artifacts);
  if (!uniqueIndexResult.ok) {
    return uniqueIndexResult;
  }
  const uniqueArtifactResult = assertArtifactIdsUnique(bundle.artifacts);
  if (!uniqueArtifactResult.ok) {
    return uniqueArtifactResult;
  }

  const artifactById = new Map(bundle.artifacts.map((artifact) => [artifact.id, artifact]));
  const drafts: BundleDraftArtifact[] = [];

  for (const indexArtifact of bundle.evidence_index.artifacts) {
    const bundleArtifact = artifactById.get(indexArtifact.id);
    if (!bundleArtifact) {
      return { ok: false, error: "invalid", artifact_id: indexArtifact.id };
    }

    if (!EVIDENCE_ARTIFACT_ID_PATTERN.test(indexArtifact.id)) {
      return { ok: false, error: "invalid", artifact_id: indexArtifact.id };
    }

    if (!indexArtifact.id.startsWith(`${indexArtifact.kind}-`)) {
      return { ok: false, error: "integrity_mismatch", artifact_id: indexArtifact.id };
    }

    if (
      bundleArtifact.id !== indexArtifact.id ||
      bundleArtifact.kind !== indexArtifact.kind ||
      bundleArtifact.sha256 !== indexArtifact.sha256 ||
      bundleArtifact.bytes !== indexArtifact.bytes ||
      bundleArtifact.created_at !== indexArtifact.created_at
    ) {
      return { ok: false, error: "integrity_mismatch", artifact_id: indexArtifact.id };
    }

    const sanitizedContent = sanitizeArtifactJsonContent(bundleArtifact.content);
    if (!sanitizedContent) {
      return { ok: false, error: "artifact_not_json", artifact_id: indexArtifact.id };
    }

    const contentText = toPrettyJson(sanitizedContent);
    const computedSha = sha256Hex(contentText);
    const computedBytes = Buffer.byteLength(contentText, "utf8");

    if (
      computedSha !== indexArtifact.sha256 ||
      computedBytes !== indexArtifact.bytes ||
      computedSha !== bundleArtifact.sha256 ||
      computedBytes !== bundleArtifact.bytes
    ) {
      return { ok: false, error: "integrity_mismatch", artifact_id: indexArtifact.id };
    }

    drafts.push({
      metadata: indexArtifact,
      contentText
    });
  }

  const totalBytes = drafts.reduce((total, draft) => total + draft.metadata.bytes, 0);
  if (totalBytes > EVIDENCE_BUNDLE_LIMITS.maxTotalBytes) {
    return { ok: false, error: "bundle_too_large" };
  }

  return { ok: true, drafts };
};

const RUNLOG_GATING_STATUSES = new Set<"pass" | "soft_fail" | "hard_fail">([
  "pass",
  "soft_fail",
  "hard_fail"
]);

const REASON_CODE_SET = new Set<ReasonCodeV0>(ReasonCodeV0Enum.options);

const deriveStubGatingDecision = (drafts: BundleDraftArtifact[]) => {
  const fallback = {
    status: "hard_fail" as const,
    core_percent: 0,
    reason_codes: [] as ReasonCodeV0[]
  };

  const gatingArtifact = drafts.find((draft) => draft.metadata.kind === "gating");
  if (!gatingArtifact) {
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(gatingArtifact.contentText) as unknown;
  } catch {
    return fallback;
  }

  if (!isRecord(parsed)) {
    return fallback;
  }

  const parsedStatus =
    typeof parsed.status === "string" && RUNLOG_GATING_STATUSES.has(parsed.status as "pass" | "soft_fail" | "hard_fail")
      ? (parsed.status as "pass" | "soft_fail" | "hard_fail")
      : fallback.status;

  const parsedCorePercent =
    typeof parsed.core_percent === "number" && Number.isFinite(parsed.core_percent)
      ? Math.max(0, Math.min(100, parsed.core_percent))
      : fallback.core_percent;

  const parsedReasonCodes = Array.isArray(parsed.reason_codes)
    ? parsed.reason_codes
        .filter((value): value is ReasonCodeV0 => typeof value === "string" && REASON_CODE_SET.has(value as ReasonCodeV0))
        .slice(0, 10)
    : fallback.reason_codes;

  return {
    status: parsedStatus,
    core_percent: parsedCorePercent,
    reason_codes: [...new Set(parsedReasonCodes)]
  };
};

const buildImportedRunLogStub = (
  bundle: EvidenceBundleV0,
  drafts: BundleDraftArtifact[]
): RadiographyRunLogV0 => {
  const gatingDecision = deriveStubGatingDecision(drafts);

  return {
    runlog_version: RADIOGRAPHY_RUNLOG_V0_VERSION,
    run_id: bundle.run_id,
    created_at: bundle.created_at,
    duration_ms: 0,
    inputs: {
      contractVersion: "0.1.0",
      business_name: "IMPORTED_BUNDLE",
      city: "UNKNOWN",
      country: "UNKNOWN",
      language: "es",
      mode_hint: "lead",
      seed_urls: {
        count: 0,
        unique_hosts: [],
        url_hashes: []
      }
    },
    buildspec: {
      schemaVersion: "0.1.0",
      eventSchemaVersion: "0.1.0",
      mode: "lead",
      capabilities: []
    },
    outputs: {
      gating_decision: gatingDecision,
      lint_report: {
        items_count: 0,
        hard_count: gatingDecision.status === "hard_fail" ? 1 : 0,
        warn_count: gatingDecision.status === "soft_fail" ? 1 : 0,
        top_reason_codes: gatingDecision.reason_codes
      },
      patch_stats: {
        ops_count: 0
      },
      provenance_coverage_percent: 0
    },
    source: "imported_bundle",
    is_stub: true,
    imported_from: {
      bundle_version: bundle.bundle_version
    }
  };
};

const PORTABLE_REPLAY_DEFAULT_GATING_DECISION = {
  status: "soft_fail" as const,
  core_percent: 50,
  reason_codes: ["needs_manual_verify"] as ReasonCodeV0[]
};

type PortableReplayGatingDecision = RadiographyRunLogV0["outputs"]["gating_decision"];

export type PortableReplayCompare = {
  baseline: PortableReplayGatingDecision;
  match: boolean;
  diff: {
    status_changed: boolean;
    core_percent_delta: number;
    reason_codes: {
      added: string[];
      removed: string[];
    };
    integrity_warnings: string[];
  };
};

export type PortableReplayComputation = {
  run_id: string;
  replay: {
    run_id: string;
    gating_decision: PortableReplayGatingDecision;
    decision_trace: DecisionTraceEntryV0[];
  };
  compare: PortableReplayCompare;
  runlog_stub: RadiographyRunLogV0;
};

type PortableReplayFailure = {
  ok: false;
  error: "invalid" | "integrity_mismatch" | "bundle_too_large";
  details?: {
    code: EvidenceBundleError;
    artifact_id?: string;
    warnings?: string[];
  };
};

const normalizeReasonCodes = (value: unknown, fallback: ReasonCodeV0[]): ReasonCodeV0[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item): item is ReasonCodeV0 => REASON_CODE_SET.has(item as ReasonCodeV0));

  return toUnique(normalized);
};

const normalizeGatingDecision = (
  value: unknown,
  fallback: PortableReplayGatingDecision
): PortableReplayGatingDecision => {
  if (!isRecord(value)) {
    return {
      status: fallback.status,
      core_percent: fallback.core_percent,
      reason_codes: [...fallback.reason_codes]
    };
  }

  const status =
    typeof value.status === "string" &&
    RUNLOG_GATING_STATUSES.has(value.status as "pass" | "soft_fail" | "hard_fail")
      ? (value.status as "pass" | "soft_fail" | "hard_fail")
      : fallback.status;

  const core_percent =
    typeof value.core_percent === "number" && Number.isFinite(value.core_percent)
      ? Math.max(0, Math.min(100, value.core_percent))
      : fallback.core_percent;

  return {
    status,
    core_percent,
    reason_codes: normalizeReasonCodes(value.reason_codes, fallback.reason_codes)
  };
};

const extractArtifactContentByKind = (
  bundle: EvidenceBundleV0,
  kind: EvidenceArtifactV0["kind"]
) => {
  const artifact = bundle.artifacts.find((entry) => entry.kind === kind);
  if (!artifact) {
    return null;
  }
  return sanitizeArtifactJsonContent(artifact.content);
};

const extractBaselineGatingDecision = (bundle: EvidenceBundleV0): PortableReplayGatingDecision => {
  const fallback = PORTABLE_REPLAY_DEFAULT_GATING_DECISION;
  const gatingContent = extractArtifactContentByKind(bundle, "gating");
  if (!gatingContent) {
    return {
      status: fallback.status,
      core_percent: fallback.core_percent,
      reason_codes: [...fallback.reason_codes]
    };
  }

  const candidate =
    isRecord(gatingContent.gating_decision) ? gatingContent.gating_decision : gatingContent;
  return normalizeGatingDecision(candidate, fallback);
};

const buildPortableReplayRunId = (bundle: EvidenceBundleV0, requestedRunId?: string) => {
  if (requestedRunId) {
    if (!RUNLOG_RUN_ID_PATTERN.test(requestedRunId)) {
      return null;
    }
    return requestedRunId;
  }

  const bundleFingerprint = sha256Hex(toPrettyJson(bundle)).slice(0, 12);
  const normalizedRunId = bundle.run_id
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 48);
  const computed = `replay-${normalizedRunId || "bundle"}-${bundleFingerprint}`.slice(0, 80);
  return RUNLOG_RUN_ID_PATTERN.test(computed) ? computed : `replay-${bundleFingerprint}`;
};

const buildPortableReplayDecisionTrace = (
  gatingDecision: PortableReplayGatingDecision,
  integrityWarnings: string[]
): DecisionTraceEntryV0[] => {
  const entries: DecisionTraceEntryV0[] = [];
  const seenCodes = new Set<string>();
  const maybePush = (entry: DecisionTraceEntryV0) => {
    if (seenCodes.has(entry.code)) {
      return;
    }
    entries.push(entry);
    seenCodes.add(entry.code);
  };

  const gatingCode = `gating_${gatingDecision.status}`;
  maybePush({
    code: gatingCode,
    severity: "info",
    message:
      TRACE_MESSAGE_BY_CODE[gatingCode] ??
      `Gating status is ${gatingDecision.status}.`
  });

  for (const reasonCode of [...gatingDecision.reason_codes].sort()) {
    maybePush({
      code: reasonCode,
      severity: BLOCKER_REASON_CODES.has(reasonCode) ? "blocker" : "warn",
      message:
        TRACE_MESSAGE_BY_CODE[reasonCode] ??
        `Review required for decision code: ${reasonCode}.`
    });
  }

  if (integrityWarnings.length > 0) {
    maybePush({
      code: "integrity_mismatch",
      severity: "blocker",
      message:
        "Evidence integrity mismatch detected during portable replay.",
      evidence_refs: [...integrityWarnings].sort()
    });
  }

  return entries.sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }
    return a.code.localeCompare(b.code);
  });
};

const extractPortableReplayInputs = (
  bundle: EvidenceBundleV0
): RadiographyRunLogV0["inputs"] => {
  const fallback: RadiographyRunLogV0["inputs"] = {
    contractVersion: "0.1.0",
    business_name: "IMPORTED_BUNDLE",
    city: "UNKNOWN",
    country: "UNKNOWN",
    language: "es",
    mode_hint: "lead",
    seed_urls: {
      count: 0,
      unique_hosts: [],
      url_hashes: []
    }
  };

  const inputsContent = extractArtifactContentByKind(bundle, "inputs_summary");
  if (!inputsContent) {
    return fallback;
  }

  const mode_hint =
    inputsContent.mode_hint === "lead" ||
    inputsContent.mode_hint === "booking" ||
    inputsContent.mode_hint === "quote"
      ? inputsContent.mode_hint
      : fallback.mode_hint;

  const seedUrlsRaw = isRecord(inputsContent.seed_urls) ? inputsContent.seed_urls : {};
  const seedUrlCount =
    typeof seedUrlsRaw.count === "number" && Number.isFinite(seedUrlsRaw.count)
      ? Math.max(0, Math.floor(seedUrlsRaw.count))
      : fallback.seed_urls.count;

  return {
    contractVersion: "0.1.0" as const,
    business_name:
      typeof inputsContent.business_name === "string" &&
      inputsContent.business_name.trim().length > 0
        ? inputsContent.business_name
        : fallback.business_name,
    city:
      typeof inputsContent.city === "string" && inputsContent.city.trim().length > 0
        ? inputsContent.city
        : fallback.city,
    country:
      typeof inputsContent.country === "string" && inputsContent.country.trim().length > 0
        ? inputsContent.country
        : fallback.country,
    language:
      typeof inputsContent.language === "string" && inputsContent.language.trim().length > 0
        ? inputsContent.language
        : fallback.language,
    mode_hint,
    seed_urls: {
      count: seedUrlCount,
      unique_hosts: normalizeHostTokens(seedUrlsRaw.unique_hosts),
      url_hashes: normalizeExistingUrlHashes(seedUrlsRaw.url_hashes)
    }
  };
};

const buildPortableReplayRunLogStub = (params: {
  bundle: EvidenceBundleV0;
  run_id: string;
  gating_decision: PortableReplayGatingDecision;
  decision_trace: DecisionTraceEntryV0[];
}): RadiographyRunLogV0 => {
  const inputs = extractPortableReplayInputs(params.bundle);
  const topReasonCodes = params.gating_decision.reason_codes.slice(0, 10);
  const hardCount = params.gating_decision.status === "hard_fail" ? 1 : 0;
  const warnCount = params.gating_decision.status === "soft_fail" ? 1 : 0;

  return {
    runlog_version: RADIOGRAPHY_RUNLOG_V0_VERSION,
    run_id: params.run_id,
    created_at: params.bundle.created_at,
    duration_ms: 0,
    inputs,
    buildspec: {
      schemaVersion: "0.1.0",
      eventSchemaVersion: "0.1.0",
      mode: inputs.mode_hint,
      capabilities: []
    },
    outputs: {
      gating_decision: params.gating_decision,
      lint_report: {
        items_count: hardCount + warnCount,
        hard_count: hardCount,
        warn_count: warnCount,
        top_reason_codes: topReasonCodes
      },
      patch_stats: {
        ops_count: 0
      },
      provenance_coverage_percent: params.gating_decision.core_percent
    },
    decision_trace: params.decision_trace,
    source: "portable_replay",
    is_stub: true,
    imported_from: {
      bundle_version: params.bundle.bundle_version
    }
  };
};

const toPortableReplayWarning = (failure: EvidenceBundleFailure) => {
  if (failure.artifact_id) {
    return `${failure.error}:${failure.artifact_id}`;
  }
  return failure.error;
};

export const computePortableReplayFromEvidenceBundle = (params: {
  bundleInput: unknown;
  strict?: boolean;
  requested_run_id?: string;
}):
  | {
      ok: true;
      result: PortableReplayComputation;
    }
  | PortableReplayFailure => {
  const strict = params.strict ?? true;
  const parsedBundle = EvidenceBundleV0Schema.safeParse(params.bundleInput);
  if (!parsedBundle.success) {
    return { ok: false, error: "invalid" };
  }

  const bundle = parsedBundle.data;
  const baseline = extractBaselineGatingDecision(bundle);
  const run_id = buildPortableReplayRunId(bundle, params.requested_run_id);
  if (!run_id) {
    return {
      ok: false,
      error: "invalid"
    };
  }

  const draftResult = buildBundleDraftArtifacts(bundle);
  const integrityWarnings: string[] = [];

  if (!draftResult.ok) {
    if (draftResult.error === "bundle_too_large") {
      return { ok: false, error: "bundle_too_large" };
    }

    if (strict) {
      return {
        ok: false,
        error: "integrity_mismatch",
        details: {
          code: draftResult.error,
          artifact_id: draftResult.artifact_id
        }
      };
    }

    integrityWarnings.push(toPortableReplayWarning(draftResult));
  }

  const replayGatingDecision =
    integrityWarnings.length > 0
      ? {
          status: PORTABLE_REPLAY_DEFAULT_GATING_DECISION.status,
          core_percent: PORTABLE_REPLAY_DEFAULT_GATING_DECISION.core_percent,
          reason_codes: [...PORTABLE_REPLAY_DEFAULT_GATING_DECISION.reason_codes]
        }
      : baseline;

  const reasonCodeDiff = diffStringLists(
    baseline.reason_codes,
    replayGatingDecision.reason_codes
  );

  const match =
    integrityWarnings.length === 0 &&
    baseline.status === replayGatingDecision.status &&
    baseline.core_percent === replayGatingDecision.core_percent &&
    reasonCodeDiff.added.length === 0 &&
    reasonCodeDiff.removed.length === 0;

  const decision_trace = buildPortableReplayDecisionTrace(
    replayGatingDecision,
    integrityWarnings
  );

  const runlog_stub = buildPortableReplayRunLogStub({
    bundle,
    run_id,
    gating_decision: replayGatingDecision,
    decision_trace
  });

  const parsedStub = RadiographyRunLogV0Schema.safeParse(runlog_stub);
  if (!parsedStub.success) {
    return { ok: false, error: "invalid" };
  }

  return {
    ok: true,
    result: {
      run_id,
      replay: {
        run_id,
        gating_decision: replayGatingDecision,
        decision_trace
      },
      compare: {
        baseline,
        match,
        diff: {
          status_changed: baseline.status !== replayGatingDecision.status,
          core_percent_delta:
            replayGatingDecision.core_percent - baseline.core_percent,
          reason_codes: reasonCodeDiff,
          integrity_warnings: [...integrityWarnings].sort()
        }
      },
      runlog_stub: parsedStub.data
    }
  };
};

export const readEvidenceBundleByRunId = async (
  run_id: string
): Promise<EvidenceBundleSuccess | EvidenceBundleFailure> => {
  if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
    return { ok: false, error: "invalid" };
  }

  const indexResult = await readEvidenceIndexByRunId(run_id);
  if (!indexResult.ok) {
    return {
      ok: false,
      error: indexResult.reason === "not_found" ? "not_found" : "invalid"
    };
  }

  const capsResult = validateBundleCaps(indexResult.evidence_index.artifacts);
  if (!capsResult.ok) {
    return capsResult;
  }

  const uniqueResult = assertArtifactIdsUnique(indexResult.evidence_index.artifacts);
  if (!uniqueResult.ok) {
    return uniqueResult;
  }

  const artifacts: EvidenceBundleArtifactV0[] = [];

  for (const artifactMetadata of indexResult.evidence_index.artifacts) {
    const artifactResult = await readEvidenceArtifactById(run_id, artifactMetadata.id);
    if (!artifactResult.ok) {
      if (artifactResult.error === "artifact_not_json") {
        return {
          ok: false,
          error: "artifact_not_json",
          artifact_id: artifactMetadata.id
        };
      }

      return {
        ok: false,
        error:
          artifactResult.error === "invalid" ? "invalid" : "integrity_mismatch",
        artifact_id: artifactMetadata.id
      };
    }

    if (
      artifactResult.artifact.id !== artifactMetadata.id ||
      artifactResult.artifact.kind !== artifactMetadata.kind ||
      artifactResult.artifact.sha256 !== artifactMetadata.sha256 ||
      artifactResult.artifact.bytes !== artifactMetadata.bytes ||
      artifactResult.artifact.created_at !== artifactMetadata.created_at
    ) {
      return { ok: false, error: "integrity_mismatch", artifact_id: artifactMetadata.id };
    }

    artifacts.push(artifactResult.artifact);
  }

  const bundle: EvidenceBundleV0 = {
    bundle_version: EVIDENCE_BUNDLE_V0_VERSION,
    run_id: indexResult.evidence_index.run_id,
    created_at: indexResult.evidence_index.created_at,
    evidence_index: indexResult.evidence_index,
    artifacts
  };

  const parsedBundle = EvidenceBundleV0Schema.safeParse(bundle);
  if (!parsedBundle.success) {
    return { ok: false, error: "invalid" };
  }

  return { ok: true, bundle: parsedBundle.data };
};

export const importEvidenceBundle = async (
  input: unknown
): Promise<
  | {
      ok: true;
      run_id: string;
      imported: {
        artifacts: number;
      };
    }
  | EvidenceBundleFailure
> => {
  const parsedBundle = EvidenceBundleV0Schema.safeParse(input);
  if (!parsedBundle.success) {
    return { ok: false, error: "invalid" };
  }

  const bundle = parsedBundle.data;
  const draftResult = buildBundleDraftArtifacts(bundle);
  if (!draftResult.ok) {
    return draftResult;
  }

  const runlogStub = buildImportedRunLogStub(bundle, draftResult.drafts);
  const parsedStub = RadiographyRunLogV0Schema.safeParse(runlogStub);
  if (!parsedStub.success) {
    return { ok: false, error: "invalid" };
  }

  await ensureRunLogDir();
  const runlogPath = getRunLogPath(bundle.run_id);
  try {
    await readFile(runlogPath, "utf8");
    return { ok: false, error: "run_already_exists" };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      return { ok: false, error: "invalid" };
    }
  }

  await ensureEvidenceDir();
  const evidenceRunDir = getEvidenceDirForRun(bundle.run_id);
  let existingEntries: string[] = [];
  try {
    existingEntries = await readdir(evidenceRunDir);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      return { ok: false, error: "invalid" };
    }
  }

  if (existingEntries.length > 0) {
    return { ok: false, error: "run_already_exists" };
  }

  await mkdir(evidenceRunDir, { recursive: true });

  for (const draft of draftResult.drafts) {
    const artifactPath = path.join(evidenceRunDir, `${draft.metadata.id}.json`);
    if (!isPathInsideDir(evidenceRunDir, artifactPath)) {
      return { ok: false, error: "invalid", artifact_id: draft.metadata.id };
    }
    await writeFile(artifactPath, draft.contentText, "utf8");
  }

  const indexPath = path.join(evidenceRunDir, "index.json");
  if (!isPathInsideDir(evidenceRunDir, indexPath)) {
    return { ok: false, error: "invalid" };
  }

  const evidenceIndex: EvidenceIndexV0 = {
    run_id: bundle.run_id,
    created_at: bundle.created_at,
    artifacts: draftResult.drafts.map((draft) => draft.metadata)
  };

  await writeFile(indexPath, toPrettyJson(evidenceIndex), "utf8");
  await writeFile(runlogPath, toPrettyJson(parsedStub.data), "utf8");

  return {
    ok: true,
    run_id: bundle.run_id,
    imported: {
      artifacts: draftResult.drafts.length
    }
  };
};
