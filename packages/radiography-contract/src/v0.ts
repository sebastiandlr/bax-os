import { z } from "zod";
import { BUILD_SPEC_V0_VERSION, BuildSpecV0Schema } from "@bax/buildspec";

export const RADIOGRAPHY_CONTRACT_V0_VERSION = "0.1.0" as const;
export const BUSINESSDNA_SCHEMA_V0_VERSION = "0.1.0" as const;
export const DISPLAY_RULES_V0_VERSION = "0.1.0" as const;

export const SourceTypeV0Enum = z.enum([
  "manual",
  "user_input",
  "gbp",
  "website",
  "instagram",
  "pdf",
  "manual_verify"
]);
export type SourceTypeV0 = z.infer<typeof SourceTypeV0Enum>;

export const FieldStatusV0Enum = z.enum([
  "verified",
  "unverified",
  "needs_verify",
  "conflict",
  "unknown"
]);
export type FieldStatusV0 = z.infer<typeof FieldStatusV0Enum>;

export const ReasonCodeV0Enum = z.enum([
  "missing_seed_url",
  "needs_manual_verify",
  "unknown_field",
  "unverified_publish_blocker",
  "missing_provenance",
  "language_not_supported",
  "insufficient_core_coverage",
  "conflict_detected",
  "lint_violation"
]);
export type ReasonCodeV0 = z.infer<typeof ReasonCodeV0Enum>;

export const LintRuleIdV0Enum = z.enum([
  "BLOCK_UNVERIFIED_PUBLISH",
  "NO_NUMBERS_WITHOUT_SOURCE",
  "LANGUAGE_MISMATCH"
]);
export type LintRuleIdV0 = z.infer<typeof LintRuleIdV0Enum>;

export const CORE_FIELDS_V0 = [
  "/identity/business_name",
  "/location/city",
  "/location/country",
  "/site/language",
  "/buildspec/mode",
  "/buildspec/capabilities"
] as const;
export const CORE_FIELDS_COUNT_V0 = CORE_FIELDS_V0.length;
export type CoreFieldV0 = (typeof CORE_FIELDS_V0)[number];

export const PUBLISH_BLOCKER_FIELDS_V0 = [
  "/contact/phone",
  "/location/address",
  "/operations/hours",
  "/offers/pricing",
  "/claims"
] as const;
export type PublishBlockerFieldV0 = (typeof PUBLISH_BLOCKER_FIELDS_V0)[number];

export const JsonPointerV0Schema = z.string().regex(/^\/.*$/, {
  message: "path must be a JSON Pointer starting with /"
});

export const JsonPatchOpV0Enum = z.enum(["add", "replace", "remove"]);

export const JsonPatchV0Schema = z
  .object({
    op: JsonPatchOpV0Enum,
    path: JsonPointerV0Schema,
    value: z.unknown().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.op === "add" || value.op === "replace") && value.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "value is required for add/replace operations"
      });
    }
  });
export type JsonPatchV0 = z.infer<typeof JsonPatchV0Schema>;

export const ConfidenceFactorsV0Schema = z
  .object({
    source_reliability: z.number().min(0).max(1),
    corroboration: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1)
  })
  .strict();
export type ConfidenceFactorsV0 = z.infer<typeof ConfidenceFactorsV0Schema>;

export const ProvenanceSourceV0Schema = z
  .object({
    source_type: SourceTypeV0Enum,
    source_ref: z.string().min(1),
    confidence: z.number().min(0).max(1)
  })
  .strict();
export type ProvenanceSourceV0 = z.infer<typeof ProvenanceSourceV0Schema>;

export const ProvenanceEntryV0Schema = z
  .object({
    status: FieldStatusV0Enum,
    value: z.unknown(),
    sources: z.array(ProvenanceSourceV0Schema).min(1),
    confidence_factors: ConfidenceFactorsV0Schema
  })
  .strict();
export type ProvenanceEntryV0 = z.infer<typeof ProvenanceEntryV0Schema>;

export const LintSeverityV0Enum = z.enum(["warn", "soft_fail", "hard_fail"]);
export type LintSeverityV0 = z.infer<typeof LintSeverityV0Enum>;

export const LintFindingV0Schema = z
  .object({
    rule_id: LintRuleIdV0Enum,
    reason_code: ReasonCodeV0Enum,
    severity: LintSeverityV0Enum,
    message: z.string().min(1)
  })
  .strict();
export type LintFindingV0 = z.infer<typeof LintFindingV0Schema>;

export const GapItemV0Schema = z
  .object({
    path: JsonPointerV0Schema,
    status: FieldStatusV0Enum,
    reason_code: ReasonCodeV0Enum
  })
  .strict();
export type GapItemV0 = z.infer<typeof GapItemV0Schema>;

export const GapReportV0Schema = z
  .object({
    reason_codes: z.array(ReasonCodeV0Enum),
    unresolved_fields: z.array(GapItemV0Schema)
  })
  .strict();
export type GapReportV0 = z.infer<typeof GapReportV0Schema>;

export const GhostPreviewConfigV0Schema = z
  .object({
    theme_id: z.string().min(1),
    layout_id: z.string().min(1),
    show_unverified: z.boolean()
  })
  .strict();
export type GhostPreviewConfigV0 = z.infer<typeof GhostPreviewConfigV0Schema>;

export const GatingDecisionV0Schema = z
  .object({
    status: z.enum(["pass", "soft_fail", "hard_fail"]),
    core_percent: z.number().min(0).max(100),
    reason_codes: z.array(ReasonCodeV0Enum)
  })
  .strict();
export type GatingDecisionV0 = z.infer<typeof GatingDecisionV0Schema>;

export const RunMetadataV0Schema = z
  .object({
    run_id: z.string().uuid(),
    duration_ms: z.number().int().nonnegative(),
    source_types_used: z.array(SourceTypeV0Enum).min(1),
    unknown_fields_count: z.number().int().nonnegative(),
    provenance_coverage_percent: z.number().min(0).max(100),
    confidence_factors: ConfidenceFactorsV0Schema
  })
  .strict();
export type RunMetadataV0 = z.infer<typeof RunMetadataV0Schema>;

export const RadiographyInputV0Schema = z
  .object({
    radiography_contract_version: z.literal(RADIOGRAPHY_CONTRACT_V0_VERSION),
    business_name: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    seed_urls: z.array(z.string().min(1)).min(1),
    mode_hint: z.enum(["lead", "booking", "quote"]).optional(),
    language: z.string().min(2)
  })
  .strict();
export type RadiographyInputV0 = z.infer<typeof RadiographyInputV0Schema>;

export const RadiographyOutputV0Schema = z
  .object({
    radiography_contract_version: z.literal(RADIOGRAPHY_CONTRACT_V0_VERSION),
    businessdna_schema_version: z.literal(BUSINESSDNA_SCHEMA_V0_VERSION),
    buildspec_schema_version: z.literal(BUILD_SPEC_V0_VERSION),
    display_rules_version: z.literal(DISPLAY_RULES_V0_VERSION),
    business_dna_patch: z.array(JsonPatchV0Schema).min(1),
    provenance_map: z.record(JsonPointerV0Schema, ProvenanceEntryV0Schema),
    gap_report: GapReportV0Schema,
    composer_preset: BuildSpecV0Schema,
    ghost_preview_config: GhostPreviewConfigV0Schema,
    gating_decision: GatingDecisionV0Schema,
    lint_report: z.array(LintFindingV0Schema),
    run_metadata: RunMetadataV0Schema
  })
  .strict();
export type RadiographyOutputV0 = z.infer<typeof RadiographyOutputV0Schema>;

export const RADIOGRAPHY_RUNLOG_V0_VERSION = "0.1.0" as const;

const RadiographyRunLogSeedUrlsV0Schema = z
  .object({
    count: z.number().int().nonnegative(),
    unique_hosts: z.array(
      z
        .string()
        .min(1)
        .regex(/^[^\/?#\s]+$/)
    ),
    url_hashes: z.array(
      z
        .string()
        .regex(/^[a-f0-9]{64}$/)
    )
  })
  .strict();

const RadiographyRunLogInputsV0Schema = z
  .object({
    contractVersion: z.literal(RADIOGRAPHY_CONTRACT_V0_VERSION),
    business_name: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    language: z.string().min(2),
    mode_hint: z.enum(["lead", "booking", "quote"]),
    seed_urls: RadiographyRunLogSeedUrlsV0Schema
  })
  .strict();

const RadiographyRunLogBuildSpecV0Schema = z
  .object({
    schemaVersion: z.string().min(1),
    eventSchemaVersion: z.string().min(1),
    mode: z.string().min(1),
    capabilities: z.array(z.string().min(1)),
    metadata: z
      .object({
        clientId: z.string().min(1).optional(),
        siteId: z.string().min(1).optional()
      })
      .strict()
      .optional()
  })
  .strict();

const RadiographyRunLogOutputsV0Schema = z
  .object({
    gating_decision: z
      .object({
        status: z.enum(["pass", "soft_fail", "hard_fail"]),
        core_percent: z.number().min(0).max(100),
        reason_codes: z.array(ReasonCodeV0Enum)
      })
      .strict(),
    lint_report: z
      .object({
        items_count: z.number().int().nonnegative(),
        hard_count: z.number().int().nonnegative(),
        warn_count: z.number().int().nonnegative(),
        top_reason_codes: z.array(ReasonCodeV0Enum)
      })
      .strict(),
    patch_stats: z
      .object({
        ops_count: z.number().int().nonnegative()
      })
      .strict(),
    provenance_coverage_percent: z.number().min(0).max(100)
  })
  .strict();

const RadiographyRunLogDebugV0Schema = z
  .object({
    core_fields_present: z.number().int().nonnegative(),
    publish_blockers_present: z.number().int().nonnegative(),
    top_missing_core_fields: z.array(JsonPointerV0Schema).max(10).optional(),
    top_blockers: z.array(ReasonCodeV0Enum).max(10).optional()
  })
  .strict();
export type RadiographyRunLogDebugV0 = z.infer<typeof RadiographyRunLogDebugV0Schema>;

export const RadiographyRunLogV0Schema = z
  .object({
    runlog_version: z.literal(RADIOGRAPHY_RUNLOG_V0_VERSION),
    run_id: z.string().min(1).regex(/^[a-z0-9-]+$/i),
    created_at: z.string().datetime(),
    duration_ms: z.number().int().nonnegative(),
    inputs: RadiographyRunLogInputsV0Schema,
    buildspec: RadiographyRunLogBuildSpecV0Schema,
    outputs: RadiographyRunLogOutputsV0Schema,
    debug: RadiographyRunLogDebugV0Schema.optional(),
    errors: z
      .array(
        z
          .object({
            message: z.string().min(1),
            stack: z.string().min(1).optional()
          })
          .strict()
      )
      .optional()
  })
  .strict();
export type RadiographyRunLogV0 = z.infer<typeof RadiographyRunLogV0Schema>;
