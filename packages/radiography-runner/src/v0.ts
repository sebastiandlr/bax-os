import {
  CORE_FIELDS_V0,
  RADIOGRAPHY_CONTRACT_V0_VERSION,
  RadiographyInputV0Schema,
  RadiographyOutputV0Schema,
  type FieldStatus,
  type ReasonCode,
  type RadiographyInputV0,
  type RadiographyOutputV0
} from "@bax/radiography-contract";
import {
  BUILD_SPEC_V0_VERSION,
  BuildSpecV0Schema,
  type BuildSpecV0
} from "@bax/buildspec";
import { DISPLAY_RULES_V0_VERSION } from "@bax/display-rules";

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 48);
};

const getCoreStatus = (value: string): FieldStatus => {
  if (value.length === 0) {
    return "unknown";
  }
  return "needs_verify";
};

const buildComposerPreset = (mode: "lead" | "booking" | "quote"): BuildSpecV0 => {
  const preset = {
    schemaVersion: BUILD_SPEC_V0_VERSION,
    eventSchemaVersion: "0.1.0",
    mode,
    capabilities: [
      "hero_identity_block",
      "offer_showcase",
      "trust_proof",
      "lead_capture",
      "faq_support",
      "analytics_core"
    ]
  };
  return BuildSpecV0Schema.parse(preset);
};

export const runRadiographyV0 = (input: RadiographyInputV0): RadiographyOutputV0 => {
  const parsed = RadiographyInputV0Schema.parse(input);

  const mode = parsed.mode_hint ?? "lead";
  const composer_preset = buildComposerPreset(mode);

  const provenance_map: Record<string, { status: FieldStatus; source_type: "user_input" }>
    = {
      business_name: { status: getCoreStatus(parsed.business_name), source_type: "user_input" },
      city: { status: getCoreStatus(parsed.city), source_type: "user_input" },
      country: { status: getCoreStatus(parsed.country), source_type: "user_input" },
      mode: { status: "needs_verify", source_type: "user_input" },
      primary_cta: { status: "unknown", source_type: "user_input" }
    };

  const verifiedCount = CORE_FIELDS_V0.filter(
    (field) => provenance_map[field]?.status === "verified"
  ).length;
  const core_percent = Math.round((verifiedCount / CORE_FIELDS_V0.length) * 100);

  const reasonCodes: ReasonCode[] = ["needs_manual_verify"];
  const unknown_fields_count = CORE_FIELDS_V0.filter(
    (field) => provenance_map[field]?.status === "unknown"
  ).length;

  const output: RadiographyOutputV0 = {
    contractVersion: RADIOGRAPHY_CONTRACT_V0_VERSION,
    businessdna_schema_version: "0.1.0",
    buildspec_version: BUILD_SPEC_V0_VERSION,
    display_rules_version: DISPLAY_RULES_V0_VERSION,
    business_dna_partial: {
      identity: {
        name: parsed.business_name
      },
      location: {
        city: parsed.city,
        country: parsed.country
      },
      mode
    },
    patches: [],
    provenance_map,
    gap_report: {
      missing_fields: ["primary_cta"],
      reason_codes: reasonCodes
    },
    composer_preset,
    ghost_preview_config: {
      enabled: false,
      mode: "static"
    },
    gating_decision: {
      status: "needs_review",
      reason_codes: reasonCodes,
      core_percent
    },
    run_metadata: {
      run_id: `demo_${slugify(parsed.business_name) || "run"}`,
      duration_ms: 0,
      source_types_used: ["user_input"],
      unknown_fields_count,
      gating_reason_codes: reasonCodes
    }
  };

  return RadiographyOutputV0Schema.parse(output);
};
