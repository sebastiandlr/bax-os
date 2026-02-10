import { useMemo } from "react";
import { runRadiographyV0 } from "@bax/radiography-runner";
import type {
  RadiographyInputsState,
  RadiographyView,
  ValidationState
} from "../_lib/types";

type UseRadiographyViewArgs = {
  validation: ValidationState;
  radiographyInputs: RadiographyInputsState;
  seedUrls: string[];
};

export type RadiographyViewController = {
  hasValidSpec: boolean;
  hasSeedUrls: boolean;
  canRunRadiography: boolean;
  radiographyView: RadiographyView | null;
  handleExportRadiography: () => void;
};

export const useRadiographyView = ({
  validation,
  radiographyInputs,
  seedUrls
}: UseRadiographyViewArgs): RadiographyViewController => {
  const hasValidSpec = validation.ok && validation.spec.capabilities.length > 0;
  const hasSeedUrls = seedUrls.length > 0;
  const canRunRadiography = hasValidSpec && hasSeedUrls;

  const radiographyView = useMemo<RadiographyView | null>(() => {
    if (!canRunRadiography || !validation.ok) {
      return null;
    }

    try {
      return runRadiographyV0(
        {
          radiography_contract_version: "0.1.0",
          business_name: radiographyInputs.business_name,
          city: radiographyInputs.city,
          country: radiographyInputs.country,
          seed_urls: seedUrls,
          mode_hint: validation.spec.mode,
          language: radiographyInputs.language
        },
        validation.spec
      );
    } catch {
      return {
        radiography_contract_version: "0.1.0",
        businessdna_schema_version: "0.1.0",
        buildspec_schema_version: "0.1.0",
        display_rules_version: "0.1.0",
        business_dna_patch: [],
        provenance_map: {},
        gap_report: {
          reason_codes: ["lint_violation"],
          unresolved_fields: []
        },
        gating_decision: {
          status: "hard_fail",
          core_percent: 0,
          reason_codes: ["lint_violation"]
        },
        lint_report: [
          {
            rule_id: "NO_NUMBERS_WITHOUT_SOURCE",
            reason_code: "lint_violation",
            severity: "hard_fail",
            message: "Runner failed to produce a deterministic output."
          }
        ],
        run_metadata: {
          run_id: "00000000-0000-4000-8000-000000000000",
          duration_ms: 0,
          source_types_used: ["manual"],
          unknown_fields_count: 0,
          provenance_coverage_percent: 0,
          confidence_factors: {
            source_reliability: 0,
            corroboration: 0,
            freshness: 0
          }
        },
        composer_preset: {
          schemaVersion: "0.1.0",
          eventSchemaVersion: "0.1.0",
          mode: validation.spec.mode,
          capabilities: validation.spec.capabilities
        },
        ghost_preview_config: {
          theme_id: "neutral-v0",
          layout_id: "single-column-v0",
          show_unverified: false
        }
      };
    }
  }, [canRunRadiography, radiographyInputs, seedUrls, validation]);

  const handleExportRadiography = () => {
    if (!radiographyView) {
      return;
    }

    const blob = new Blob([`${JSON.stringify(radiographyView, null, 2)}\n`], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "radiography.v0.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return {
    hasValidSpec,
    hasSeedUrls,
    canRunRadiography,
    radiographyView,
    handleExportRadiography
  };
};
