import type { RadiographyView } from "../_lib/types";

type RadiographyPanelProps = {
  hasValidSpec: boolean;
  hasSeedUrls: boolean;
  canRunRadiography: boolean;
  radiographyView: RadiographyView | null;
  onExportRadiography: () => void;
};

export function RadiographyPanel({
  hasValidSpec,
  hasSeedUrls,
  canRunRadiography,
  radiographyView,
  onExportRadiography
}: RadiographyPanelProps) {
  return (
    <>
      {!hasValidSpec ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400">
          Radiography: blocked (invalid BuildSpec)
        </div>
      ) : null}

      {hasValidSpec && !hasSeedUrls ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400">
          <div>Radiography: blocked (missing seed_urls)</div>
          <ul className="mt-2 list-disc pl-5 text-zinc-300">
            <li>missing_seed_url</li>
          </ul>
        </div>
      ) : null}

      {canRunRadiography && radiographyView ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-zinc-200">Radiography</div>
            <button
              type="button"
              onClick={onExportRadiography}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Export Radiography JSON
            </button>
          </div>
          <div className="mt-1 text-zinc-400">
            contractVersion:{" "}
            <span className="text-zinc-200">
              {radiographyView.radiography_contract_version}
            </span>
          </div>
          <div className="mt-1 text-zinc-400">
            status:{" "}
            <span className="text-zinc-200">{radiographyView.gating_decision.status}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            core_percent:{" "}
            <span className="text-zinc-200">{radiographyView.gating_decision.core_percent}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            unknown_fields_count:{" "}
            <span className="text-zinc-200">{radiographyView.run_metadata.unknown_fields_count}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            provenance_coverage_percent:{" "}
            <span className="text-zinc-200">
              {radiographyView.run_metadata.provenance_coverage_percent}
            </span>
          </div>
          <div className="mt-1 text-zinc-400">
            patch_ops:{" "}
            <span className="text-zinc-200">{radiographyView.business_dna_patch.length}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            display_rules_version:{" "}
            <span className="text-zinc-200">{radiographyView.display_rules_version}</span>
          </div>
          <div className="mt-2 text-zinc-300">gating reason_codes</div>
          <ul className="mt-2 list-disc pl-5 text-zinc-300">
            {radiographyView.gating_decision.reason_codes.map((reasonCode) => (
              <li key={reasonCode}>{reasonCode}</li>
            ))}
          </ul>
          <div className="mt-2 text-zinc-300">lint_report</div>
          <ul className="mt-2 list-disc pl-5 text-zinc-300">
            {radiographyView.lint_report.map((finding) => (
              <li key={`${finding.rule_id}-${finding.reason_code}`}>
                {finding.rule_id} ({finding.reason_code})
              </li>
            ))}
          </ul>
          <div className="mt-2 text-zinc-400">
            composer_preset:{" "}
            <span className="text-zinc-200">{radiographyView.composer_preset.mode}</span>{" "}
            ({radiographyView.composer_preset.capabilities.length} capabilities)
          </div>
        </div>
      ) : null}
    </>
  );
}
