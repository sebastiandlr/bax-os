import type { RadiographyView, RunLogListItem } from "../_lib/types";

type RunSummary = {
  run_id: string;
  created_at: string;
  duration_ms: number;
};

type RadiographyPanelProps = {
  hasValidSpec: boolean;
  hasSeedUrls: boolean;
  canRunRadiography: boolean;
  radiographyView: RadiographyView | null;
  latestRunSummary: RunSummary | null;
  runLogWarning: string | null;
  isLatestRunLogOpen: boolean;
  runLogViewerTitle: string;
  latestRunLogText: string;
  runLogList: RunLogListItem[];
  isRunLogListLoading: boolean;
  runLogListError: string | null;
  onExportRadiography: () => void;
  onOpenLatestRunLog: () => Promise<void>;
  onDownloadLatestRunLog: () => Promise<void>;
  onRefreshRunLogs: () => Promise<void>;
  onOpenRunLogById: (runId: string) => Promise<void>;
  onDownloadRunLogById: (runId: string) => Promise<void>;
  onCloseLatestRunLog: () => void;
};

export function RadiographyPanel({
  hasValidSpec,
  hasSeedUrls,
  canRunRadiography,
  radiographyView,
  latestRunSummary,
  runLogWarning,
  isLatestRunLogOpen,
  runLogViewerTitle,
  latestRunLogText,
  runLogList,
  isRunLogListLoading,
  runLogListError,
  onExportRadiography,
  onOpenLatestRunLog,
  onDownloadLatestRunLog,
  onRefreshRunLogs,
  onOpenRunLogById,
  onDownloadRunLogById,
  onCloseLatestRunLog
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

          <div className="mt-2 text-zinc-400">
            last_run_id:{" "}
            <span className="text-zinc-200">{latestRunSummary?.run_id ?? "n/a"}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            created_at:{" "}
            <span className="text-zinc-200">{latestRunSummary?.created_at ?? "n/a"}</span>
          </div>
          <div className="mt-1 text-zinc-400">
            duration_ms:{" "}
            <span className="text-zinc-200">
              {latestRunSummary ? latestRunSummary.duration_ms : "n/a"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void onOpenLatestRunLog();
              }}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Open Latest Run Log
            </button>
            <button
              type="button"
              onClick={() => {
                void onDownloadLatestRunLog();
              }}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Download Latest Run Log
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-zinc-200">Run Logs</div>
              <button
                type="button"
                onClick={() => {
                  void onRefreshRunLogs();
                }}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
              >
                {isRunLogListLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {runLogListError ? (
              <div className="mt-2 text-xs text-amber-300">{runLogListError}</div>
            ) : null}

            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="px-2 py-1">created_at</th>
                    <th className="px-2 py-1">run_id</th>
                    <th className="px-2 py-1">status</th>
                    <th className="px-2 py-1">core_percent</th>
                    <th className="px-2 py-1">seed_urls_count</th>
                    <th className="px-2 py-1">unique_hosts_count</th>
                    <th className="px-2 py-1">duration_ms</th>
                    <th className="px-2 py-1">reason_codes</th>
                    <th className="px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runLogList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-2 py-2 text-zinc-500">
                        No run logs found.
                      </td>
                    </tr>
                  ) : (
                    runLogList.map((item) => {
                      const topReasonCodes = item.reason_codes.slice(0, 2);
                      return (
                        <tr key={item.run_id} className="border-b border-zinc-900/80">
                          <td className="px-2 py-1 align-top">{item.created_at}</td>
                          <td className="px-2 py-1 align-top font-mono text-[11px] text-zinc-200">
                            {item.run_id}
                          </td>
                          <td className="px-2 py-1 align-top">{item.status}</td>
                          <td className="px-2 py-1 align-top">{item.core_percent}</td>
                          <td className="px-2 py-1 align-top">{item.seed_urls_count}</td>
                          <td className="px-2 py-1 align-top">{item.unique_hosts_count}</td>
                          <td className="px-2 py-1 align-top">{item.duration_ms}</td>
                          <td className="px-2 py-1 align-top">
                            {topReasonCodes.length > 0 ? topReasonCodes.join(", ") : "n/a"}
                          </td>
                          <td className="px-2 py-1 align-top">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void onOpenRunLogById(item.run_id);
                                }}
                                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void onDownloadRunLogById(item.run_id);
                                }}
                                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                              >
                                Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {runLogWarning ? (
            <div className="mt-2 rounded-md border border-amber-700 bg-amber-950/30 px-2 py-1 text-xs text-amber-300">
              {runLogWarning}
            </div>
          ) : null}

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

          {isLatestRunLogOpen ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-zinc-200">{runLogViewerTitle}</span>
                <button
                  type="button"
                  onClick={onCloseLatestRunLog}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Close
                </button>
              </div>
              <textarea
                readOnly
                value={latestRunLogText}
                className="min-h-[220px] w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-200"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
