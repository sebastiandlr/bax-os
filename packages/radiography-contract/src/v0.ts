import { z } from "zod";
import { BuildSpecV0Schema } from "@bax/buildspec";

export const RADIOGRAPHY_CONTRACT_V0_VERSION = "0.1.0" as const;

export const SourceTypeEnum = z.enum([
  "gbp",
  "website",
  "instagram",
  "pdf",
  "user_input",
  "manual_verify"
]);
export type SourceType = z.infer<typeof SourceTypeEnum>;

export const FieldStatusEnum = z.enum([
  "verified",
  "unverified",
  "needs_verify",
  "conflict",
  "unknown"
]);
export type FieldStatus = z.infer<typeof FieldStatusEnum>;

export const ReasonCodeEnum = z.enum([
  "missing_seed_url",
  "insufficient_sources",
  "needs_manual_verify",
  "conflict_detected",
  "unknown_fields_present"
]);
export type ReasonCode = z.infer<typeof ReasonCodeEnum>;

export const CORE_FIELDS_V0 = [
  "business_name",
  "city",
  "country",
  "mode",
  "primary_cta"
] as const;
export type CoreField = (typeof CORE_FIELDS_V0)[number];

export const JsonPatchOpEnum = z.enum(["add", "replace", "remove"]);
export const JsonPatchV0Schema = z
  .object({
    op: JsonPatchOpEnum,
    path: z.string().min(1),
    value: z.unknown().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.op === "add" || value.op === "replace") && value.value === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "value is required for add/replace operations",
        path: ["value"]
      });
    }
  });
export type JsonPatchV0 = z.infer<typeof JsonPatchV0Schema>;

export const RadiographyInputV0Schema = z
  .object({
    contractVersion: z.literal(RADIOGRAPHY_CONTRACT_V0_VERSION),
    business_name: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    seed_urls: z.array(z.string().min(1)).min(1),
    mode_hint: z.enum(["lead", "booking", "quote"]).optional(),
    language: z.string().min(2)
  })
  .strict();
export type RadiographyInputV0 = z.infer<typeof RadiographyInputV0Schema>;

const ProvenanceEntryV0Schema = z
  .object({
    status: FieldStatusEnum,
    source_type: SourceTypeEnum,
    reason_code: ReasonCodeEnum.optional(),
    source_url: z.string().url().optional()
  })
  .strict();

const GapReportV0Schema = z
  .object({
    missing_fields: z.array(z.string()),
    reason_codes: z.array(ReasonCodeEnum)
  })
  .strict();

const GhostPreviewConfigV0Schema = z
  .object({
    enabled: z.boolean(),
    mode: z.enum(["static", "theatre"]),
    preview_url: z.string().url().optional()
  })
  .strict();

const GatingDecisionV0Schema = z
  .object({
    status: z.enum(["pass", "needs_review", "blocked"]),
    reason_codes: z.array(ReasonCodeEnum),
    core_percent: z.number().min(0).max(100)
  })
  .strict();

const RunMetadataV0Schema = z
  .object({
    run_id: z.string().min(1),
    duration_ms: z.number().int().nonnegative(),
    source_types_used: z.array(SourceTypeEnum),
    unknown_fields_count: z.number().int().nonnegative(),
    gating_reason_codes: z.array(ReasonCodeEnum)
  })
  .strict();

export const RadiographyOutputV0Schema = z
  .object({
    contractVersion: z.literal(RADIOGRAPHY_CONTRACT_V0_VERSION),
    businessdna_schema_version: z.string().min(1),
    buildspec_version: z.string().min(1),
    display_rules_version: z.string().min(1),
    business_dna_partial: z.record(z.string(), z.unknown()),
    patches: z.array(JsonPatchV0Schema),
    provenance_map: z.record(z.string(), ProvenanceEntryV0Schema),
    gap_report: GapReportV0Schema,
    composer_preset: BuildSpecV0Schema,
    ghost_preview_config: GhostPreviewConfigV0Schema,
    gating_decision: GatingDecisionV0Schema,
    run_metadata: RunMetadataV0Schema
  })
  .strict();
export type RadiographyOutputV0 = z.infer<typeof RadiographyOutputV0Schema>;
