import {
  BUILD_SPEC_V0_VERSION,
  BuildSpecV0Schema,
  type BuildSpecV0,
  type BuildSpecV0CapabilityId
} from "@bax/buildspec";
import {
  DISPLAY_RULES_V0_VERSION,
  safeCopyFor,
  shouldShowField
} from "@bax/display-rules";
import {
  BUSINESSDNA_SCHEMA_V0_VERSION,
  CORE_FIELDS_V0,
  PUBLISH_BLOCKER_FIELDS_V0,
  RADIOGRAPHY_CONTRACT_V0_VERSION,
  RadiographyInputV0Schema,
  RadiographyOutputV0Schema,
  type ConfidenceFactorsV0,
  type FieldStatusV0,
  type JsonPatchV0,
  type LintFindingV0,
  type RadiographyInputV0,
  type RadiographyOutputV0,
  type ReasonCodeV0,
  type SourceTypeV0
} from "@bax/radiography-contract";

const ALLOWED_LANGUAGES = new Set(["es", "es-mx", "en", "en-us"]);

const createRunId = (): string => {
  // Deterministic format for UUIDv4-compatible identifiers without external deps.
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  let seed = Date.now() + Math.floor(Math.random() * 1_000_000);
  return template.replace(/[xy]/g, (token) => {
    seed = (seed * 9301 + 49297) % 233280;
    const randomNibble = Math.floor((seed / 233280) * 16);
    const value = token === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
};

const DEFAULT_CAPABILITIES_BY_MODE: Record<BuildSpecV0["mode"], BuildSpecV0CapabilityId[]> = {
  lead: [
    "hero_identity_block",
    "offer_showcase",
    "primary_transaction",
    "trust_proof",
    "lead_capture",
    "analytics_core"
  ],
  booking: [
    "hero_identity_block",
    "primary_transaction",
    "location_router",
    "trust_proof",
    "faq_support",
    "analytics_core"
  ],
  quote: [
    "hero_identity_block",
    "offer_showcase",
    "primary_transaction",
    "trust_proof",
    "lead_capture",
    "analytics_core"
  ]
};

const uniqueReasonCodes = (codes: ReasonCodeV0[]): ReasonCodeV0[] => {
  return [...new Set(codes)];
};

const getFallbackBuildSpec = (mode: BuildSpecV0["mode"]): BuildSpecV0 => {
  return BuildSpecV0Schema.parse({
    schemaVersion: BUILD_SPEC_V0_VERSION,
    eventSchemaVersion: "0.1.0",
    mode,
    capabilities: DEFAULT_CAPABILITIES_BY_MODE[mode]
  });
};

const getStatusForPath = (path: string): FieldStatusV0 => {
  if (path === "/buildspec/mode" || path === "/buildspec/capabilities") {
    return "verified";
  }
  return "needs_verify";
};

const reasonForStatus = (status: FieldStatusV0): ReasonCodeV0 => {
  if (status === "conflict") {
    return "conflict_detected";
  }
  if (status === "unknown") {
    return "unknown_field";
  }
  if (status === "unverified" || status === "needs_verify") {
    return "needs_manual_verify";
  }
  return "needs_manual_verify";
};

const averageConfidence = (
  entries: Record<string, { confidence_factors: ConfidenceFactorsV0 }>
): ConfidenceFactorsV0 => {
  const all = Object.values(entries);
  if (all.length === 0) {
    return {
      source_reliability: 0,
      corroboration: 0,
      freshness: 0
    };
  }

  const totals = all.reduce(
    (acc, entry) => {
      acc.source_reliability += entry.confidence_factors.source_reliability;
      acc.corroboration += entry.confidence_factors.corroboration;
      acc.freshness += entry.confidence_factors.freshness;
      return acc;
    },
    {
      source_reliability: 0,
      corroboration: 0,
      freshness: 0
    }
  );

  return {
    source_reliability: Number((totals.source_reliability / all.length).toFixed(3)),
    corroboration: Number((totals.corroboration / all.length).toFixed(3)),
    freshness: Number((totals.freshness / all.length).toFixed(3))
  };
};

type LintContext = {
  input: RadiographyInputV0;
  business_dna_patch: JsonPatchV0[];
  provenance_map: RadiographyOutputV0["provenance_map"];
};

export const lintRadiographyV0 = (context: LintContext): LintFindingV0[] => {
  const findings: LintFindingV0[] = [];

  const hasUnverifiedPublishBlocker = PUBLISH_BLOCKER_FIELDS_V0.some((fieldPath) => {
    const status = context.provenance_map[fieldPath]?.status ?? "unknown";
    return !shouldShowField({ fieldPath, status });
  });
  if (hasUnverifiedPublishBlocker) {
    findings.push({
      rule_id: "BLOCK_UNVERIFIED_PUBLISH",
      reason_code: "unverified_publish_blocker",
      severity: "hard_fail",
      message:
        "Publish-blocker fields remain hidden because they are not verified."
    });
  }

  const hasNumberWithoutSource = context.business_dna_patch.some((operation) => {
    if (typeof operation.value !== "string" || !/\d/.test(operation.value)) {
      return false;
    }
    const entry = context.provenance_map[operation.path];
    return !entry || entry.sources.length === 0;
  });
  if (hasNumberWithoutSource) {
    findings.push({
      rule_id: "NO_NUMBERS_WITHOUT_SOURCE",
      reason_code: "missing_provenance",
      severity: "soft_fail",
      message:
        "Numeric content exists without provenance. Add a source before publishing."
    });
  }

  if (!ALLOWED_LANGUAGES.has(context.input.language.toLowerCase())) {
    findings.push({
      rule_id: "LANGUAGE_MISMATCH",
      reason_code: "language_not_supported",
      severity: "warn",
      message: "Language is outside the deterministic allowlist for v0."
    });
  }

  return findings;
};

const getSourceTypesUsed = (
  provenanceMap: RadiographyOutputV0["provenance_map"]
): SourceTypeV0[] => {
  const values = Object.values(provenanceMap);
  const types = new Set<SourceTypeV0>();
  for (const value of values) {
    for (const source of value.sources) {
      types.add(source.source_type);
    }
  }
  if (types.size === 0) {
    types.add("manual");
  }
  return [...types];
};

export const runRadiographyV0 = (
  input: RadiographyInputV0,
  buildSpec?: BuildSpecV0
): RadiographyOutputV0 => {
  const startedAt = Date.now();
  const parsedInput = RadiographyInputV0Schema.parse(input);
  const composer_preset = buildSpec
    ? BuildSpecV0Schema.parse(buildSpec)
    : getFallbackBuildSpec(parsedInput.mode_hint ?? "lead");

  const business_dna_patch: JsonPatchV0[] = [
    {
      op: "add",
      path: "/identity/business_name",
      value: parsedInput.business_name
    },
    {
      op: "add",
      path: "/location/city",
      value: parsedInput.city
    },
    {
      op: "add",
      path: "/location/country",
      value: parsedInput.country
    },
    {
      op: "add",
      path: "/site/language",
      value: parsedInput.language
    },
    {
      op: "add",
      path: "/buildspec/mode",
      value: composer_preset.mode
    },
    {
      op: "add",
      path: "/buildspec/capabilities",
      value: composer_preset.capabilities
    }
  ];

  const provenance_map: RadiographyOutputV0["provenance_map"] = {};

  for (const operation of business_dna_patch) {
    provenance_map[operation.path] = {
      status: getStatusForPath(operation.path),
      value: operation.value ?? null,
      sources: [
        {
          source_type: "manual",
          source_ref: operation.path.startsWith("/buildspec/")
            ? "buildspec_v0"
            : "radiography_input_v0",
          confidence: operation.path.startsWith("/buildspec/") ? 1 : 0.55
        }
      ],
      confidence_factors: operation.path.startsWith("/buildspec/")
        ? {
            source_reliability: 1,
            corroboration: 1,
            freshness: 1
          }
        : {
            source_reliability: 0.55,
            corroboration: 0.3,
            freshness: 1
          }
    };
  }

  for (const fieldPath of PUBLISH_BLOCKER_FIELDS_V0) {
    provenance_map[fieldPath] = {
      status: "unknown",
      value: safeCopyFor(fieldPath, parsedInput.language),
      sources: [
        {
          source_type: "manual",
          source_ref: "safe_copy_template",
          confidence: 0.15
        }
      ],
      confidence_factors: {
        source_reliability: 0.15,
        corroboration: 0,
        freshness: 1
      }
    };
  }

  const lint_report = lintRadiographyV0({
    input: parsedInput,
    business_dna_patch,
    provenance_map
  });

  const unresolved_fields = Object.entries(provenance_map)
    .filter(([, entry]) => entry.status !== "verified")
    .map(([path, entry]) => ({
      path,
      status: entry.status,
      reason_code: reasonForStatus(entry.status)
    }));

  const gap_reason_codes = uniqueReasonCodes(
    unresolved_fields.map((item) => item.reason_code)
  );
  const lint_reason_codes = lint_report.map((finding) => finding.reason_code);

  const verifiedCoreCount = CORE_FIELDS_V0.filter((fieldPath) => {
    return provenance_map[fieldPath]?.status === "verified";
  }).length;
  const core_percent = Math.round((verifiedCoreCount / CORE_FIELDS_V0.length) * 100);

  const unknown_fields_count = Object.values(provenance_map).filter((entry) => {
    return entry.status === "unknown";
  }).length;

  const entriesWithSources = Object.values(provenance_map).filter((entry) => {
    return entry.sources.length > 0;
  }).length;
  const provenance_coverage_percent = Math.round(
    (entriesWithSources / Object.keys(provenance_map).length) * 100
  );

  const hasHardFail = lint_report.some((finding) => finding.severity === "hard_fail");
  const hasSoftFail = lint_report.some((finding) => finding.severity === "soft_fail");
  const status: RadiographyOutputV0["gating_decision"]["status"] = hasHardFail
    ? "hard_fail"
    : hasSoftFail || core_percent < 100
      ? "soft_fail"
      : "pass";

  const coverage_reason_codes: ReasonCodeV0[] =
    core_percent < 100 ? ["insufficient_core_coverage"] : [];
  const gating_reason_codes = uniqueReasonCodes([
    ...gap_reason_codes,
    ...lint_reason_codes,
    ...coverage_reason_codes
  ]);

  const duration_ms = Date.now() - startedAt;
  const run_id = createRunId();

  const output: RadiographyOutputV0 = {
    radiography_contract_version: RADIOGRAPHY_CONTRACT_V0_VERSION,
    businessdna_schema_version: BUSINESSDNA_SCHEMA_V0_VERSION,
    buildspec_schema_version: BUILD_SPEC_V0_VERSION,
    display_rules_version: DISPLAY_RULES_V0_VERSION,
    business_dna_patch,
    provenance_map,
    gap_report: {
      reason_codes: gap_reason_codes,
      unresolved_fields
    },
    composer_preset,
    ghost_preview_config: {
      theme_id: "neutral-v0",
      layout_id: "single-column-v0",
      show_unverified: false
    },
    gating_decision: {
      status,
      core_percent,
      reason_codes: gating_reason_codes
    },
    lint_report,
    run_metadata: {
      run_id,
      duration_ms,
      source_types_used: getSourceTypesUsed(provenance_map),
      unknown_fields_count,
      provenance_coverage_percent,
      confidence_factors: averageConfidence(provenance_map)
    }
  };

  return RadiographyOutputV0Schema.parse(output);
};
