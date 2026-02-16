import { useState } from "react";
import type {
  EvidenceBundleDraft,
  EvidenceIndex,
  RadiographyRunLog,
  RadiographyView,
  RunLogDiff,
  RunLogListItem
} from "../_lib/types";

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
  selectedRunId: string | null;
  selectedRunLog: RadiographyRunLog | null;
  selectedRunEvidence: EvidenceIndex | null;
  selectedRunEvidenceError: string | null;
  runLogDiff: RunLogDiff | null;
  latestRunSummary: RunSummary | null;
  runLogWarning: string | null;
  isLatestRunLogOpen: boolean;
  runLogViewerTitle: string;
  latestRunLogText: string;
  runLogList: RunLogListItem[];
  isRunLogListLoading: boolean;
  runLogListError: string | null;
  isRunLogPruneLoading: boolean;
  isRunLogReplayLoading: boolean;
  isRunLogDiffLoading: boolean;
  bundleExporting: boolean;
  bundleImporting: boolean;
  bundleImportError: string | null;
  bundleImportOk: string | null;
  bundleDraft: EvidenceBundleDraft | null;
  bundleDraftError: string | null;
  runLogOpsMessage: string | null;
  onExportRadiography: () => void;
  onExportEvidenceBundle: (runId: string) => Promise<void>;
  onImportEvidenceBundle: (bundle: unknown) => Promise<{ run_id: string }>;
  onSetBundleDraftFromText: (jsonText: string) => void;
  onSetBundleDraftFromUnknown: (value: unknown) => void;
  onClearBundleDraft: () => void;
  onOpenLatestRunLog: () => Promise<void>;
  onDownloadLatestRunLog: () => Promise<void>;
  onRefreshRunLogs: () => Promise<void>;
  onOpenRunLogById: (runId: string) => Promise<void>;
  onDownloadRunLogById: (runId: string) => Promise<void>;
  onPruneRunLogs: (maxFiles: number, maxAgeDays: number) => Promise<void>;
  onReplayRunLog: (
    runId: string,
    seedUrlsRaw: string[],
    mode: "persist" | "dry_run"
  ) => Promise<void>;
  onComputeRunLogDiff: (fromRunId: string, toRunId: string) => Promise<void>;
  onCloseLatestRunLog: () => void;
};

export function RadiographyPanel({
  hasValidSpec,
  hasSeedUrls,
  canRunRadiography,
  radiographyView,
  selectedRunId,
  selectedRunLog,
  selectedRunEvidence,
  selectedRunEvidenceError,
  runLogDiff,
  latestRunSummary,
  runLogWarning,
  isLatestRunLogOpen,
  runLogViewerTitle,
  latestRunLogText,
  runLogList,
  isRunLogListLoading,
  runLogListError,
  isRunLogPruneLoading,
  isRunLogReplayLoading,
  isRunLogDiffLoading,
  bundleExporting,
  bundleImporting,
  bundleImportError,
  bundleImportOk,
  bundleDraft,
  bundleDraftError,
  runLogOpsMessage,
  onExportRadiography,
  onExportEvidenceBundle,
  onImportEvidenceBundle,
  onSetBundleDraftFromText,
  onSetBundleDraftFromUnknown,
  onClearBundleDraft,
  onOpenLatestRunLog,
  onDownloadLatestRunLog,
  onRefreshRunLogs,
  onOpenRunLogById,
  onDownloadRunLogById,
  onPruneRunLogs,
  onReplayRunLog,
  onComputeRunLogDiff,
  onCloseLatestRunLog
}: RadiographyPanelProps) {
  const [isPruneDialogOpen, setIsPruneDialogOpen] = useState(false);
  const [isReplayDialogOpen, setIsReplayDialogOpen] = useState(false);
  const [replayRunId, setReplayRunId] = useState("");
  const [replaySeedUrlsText, setReplaySeedUrlsText] = useState("");
  const [diffFromRunId, setDiffFromRunId] = useState("");
  const [diffToRunId, setDiffToRunId] = useState("");
  const [maxFilesInput, setMaxFilesInput] = useState("200");
  const [maxAgeDaysInput, setMaxAgeDaysInput] = useState("14");
  const [bundleText, setBundleText] = useState("");
  const [bundleInputStatus, setBundleInputStatus] = useState<string | null>(null);

  const handleConfirmPrune = async () => {
    const maxFiles = Number.parseInt(maxFilesInput, 10);
    const maxAgeDays = Number.parseInt(maxAgeDaysInput, 10);
    if (!Number.isFinite(maxFiles) || !Number.isFinite(maxAgeDays)) {
      return;
    }

    await onPruneRunLogs(maxFiles, maxAgeDays);
    setIsPruneDialogOpen(false);
  };

  const getReplaySeedUrls = () => {
    return replaySeedUrlsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const selectedTrace = selectedRunLog?.decision_trace ?? [];

  const formatDelta = (value: number) => {
    if (value > 0) {
      return `+${value}`;
    }
    return `${value}`;
  };

  const getSeverityBadgeClass = (severity: "info" | "warn" | "blocker") => {
    if (severity === "blocker") {
      return "rounded bg-rose-950/50 px-1.5 py-0.5 text-rose-300";
    }
    if (severity === "warn") {
      return "rounded bg-amber-950/50 px-1.5 py-0.5 text-amber-300";
    }
    return "rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300";
  };

  const MAX_BUNDLE_FILE_BYTES = 2 * 1024 * 1024;
  const activeBundleRunId = selectedRunId ?? selectedRunEvidence?.run_id ?? selectedRunLog?.run_id ?? null;
  const bundlePreviewItems = bundleDraft?.evidence_index.artifacts.slice(0, 10) ?? [];

  const handleBundleTextChange = (value: string) => {
    setBundleText(value);
    onSetBundleDraftFromText(value);
    setBundleInputStatus(null);
  };

  const handleBundleFileLoad = async (file: File) => {
    if (file.size > MAX_BUNDLE_FILE_BYTES) {
      setBundleInputStatus("File too large. Max supported file size is 2MB.");
      onClearBundleDraft();
      return;
    }

    try {
      const text = await file.text();
      setBundleText(text);
      try {
        const parsed = JSON.parse(text) as unknown;
        onSetBundleDraftFromUnknown(parsed);
      } catch {
        onSetBundleDraftFromText(text);
      }
      setBundleInputStatus(`Loaded file: ${file.name}`);
    } catch {
      setBundleInputStatus("Unable to read bundle file.");
      onClearBundleDraft();
    }
  };

  const handleBundleImport = async () => {
    if (!bundleDraft || bundleImporting) {
      return;
    }

    setBundleInputStatus(null);
    try {
      const result = await onImportEvidenceBundle(bundleDraft);
      setBundleInputStatus(`Imported bundle for ${result.run_id}.`);
    } catch {
      // The hook already maps and stores safe error messages.
    }
  };

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
                            {item.top_blockers && item.top_blockers.length > 0 ? (
                              <div className="mt-1 text-[10px] text-zinc-500">
                                blockers: {item.top_blockers.slice(0, 2).join(", ")}
                              </div>
                            ) : null}
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
                              <button
                                type="button"
                                onClick={() => {
                                  setReplayRunId(item.run_id);
                                  setIsReplayDialogOpen(true);
                                }}
                                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                              >
                                Replay
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

            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-300">RunLog Ops</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPruneDialogOpen(true);
                    }}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                  >
                    {isRunLogPruneLoading ? "Pruning..." : "Prune Run Logs"}
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={diffFromRunId}
                  onChange={(event) => {
                    setDiffFromRunId(event.target.value);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="">Diff from...</option>
                  {runLogList.map((item) => (
                    <option key={`from-${item.run_id}`} value={item.run_id}>
                      {item.run_id}
                    </option>
                  ))}
                </select>
                <select
                  value={diffToRunId}
                  onChange={(event) => {
                    setDiffToRunId(event.target.value);
                  }}
                  className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="">Diff to...</option>
                  {runLogList.map((item) => (
                    <option key={`to-${item.run_id}`} value={item.run_id}>
                      {item.run_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    void onComputeRunLogDiff(diffFromRunId, diffToRunId);
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  {isRunLogDiffLoading ? "Diffing..." : "Compute Diff"}
                </button>
              </div>
              {runLogOpsMessage ? (
                <div className="mt-2 text-xs text-zinc-400">{runLogOpsMessage}</div>
              ) : null}
            </div>
          </div>

          {isPruneDialogOpen ? (
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900/80 p-3">
              <div className="text-sm text-zinc-200">Confirm prune run logs</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-400">
                  maxFiles
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={maxFilesInput}
                    onChange={(event) => {
                      setMaxFilesInput(event.target.value);
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  maxAgeDays
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={maxAgeDaysInput}
                    onChange={(event) => {
                      setMaxAgeDaysInput(event.target.value);
                    }}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPruneDialogOpen(false);
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmPrune();
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Confirm Prune
                </button>
              </div>
            </div>
          ) : null}

          {isReplayDialogOpen ? (
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900/80 p-3">
              <div className="text-sm text-zinc-200">Replay Run Log: {replayRunId}</div>
              <label className="mt-2 block text-xs text-zinc-400">
                seed_urls_override (one URL per line)
                <textarea
                  value={replaySeedUrlsText}
                  onChange={(event) => {
                    setReplaySeedUrlsText(event.target.value);
                  }}
                  className="mt-1 min-h-[90px] w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-200"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsReplayDialogOpen(false);
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onReplayRunLog(replayRunId, getReplaySeedUrls(), "persist");
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  {isRunLogReplayLoading ? "Replaying..." : "Replay (persist)"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onReplayRunLog(replayRunId, getReplaySeedUrls(), "dry_run");
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  {isRunLogReplayLoading ? "Replaying..." : "Replay (dry-run)"}
                </button>
              </div>
            </div>
          ) : null}

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

          {runLogDiff ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-zinc-200">Diff Summary</div>
              <div className="mt-2 text-zinc-400">
                from: <span className="font-mono text-zinc-200">{runLogDiff.from}</span>
              </div>
              <div className="mt-1 text-zinc-400">
                to: <span className="font-mono text-zinc-200">{runLogDiff.to}</span>
              </div>
              <div className="mt-2 text-zinc-400">
                gating:{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.gating.from.status} ({runLogDiff.changes.gating.from.core_percent})
                </span>{" "}
                <span className="text-zinc-500">→</span>{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.gating.to.status} ({runLogDiff.changes.gating.to.core_percent})
                </span>
              </div>
              <div className="mt-2 text-zinc-300">blockers</div>
              <div className="mt-1 text-zinc-400">
                added:{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.blockers.added.length > 0
                    ? runLogDiff.changes.blockers.added.join(", ")
                    : "none"}
                </span>
              </div>
              <div className="mt-1 text-zinc-400">
                removed:{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.blockers.removed.length > 0
                    ? runLogDiff.changes.blockers.removed.join(", ")
                    : "none"}
                </span>
              </div>
              <div className="mt-2 text-zinc-300">key deltas</div>
              <div className="mt-1 text-zinc-400">
                patch_ops_count delta:{" "}
                <span className="text-zinc-200">
                  {formatDelta(runLogDiff.changes.patch_ops_count.delta)}
                </span>
              </div>
              <div className="mt-1 text-zinc-400">
                provenance_coverage delta:{" "}
                <span className="text-zinc-200">
                  {formatDelta(runLogDiff.changes.provenance_coverage_percent.delta)}
                </span>
              </div>
              <div className="mt-1 text-zinc-400">
                lint delta:{" "}
                <span className="text-zinc-200">
                  hard {formatDelta(runLogDiff.changes.lint.hard_delta)}, warn{" "}
                  {formatDelta(runLogDiff.changes.lint.warn_delta)}, items{" "}
                  {formatDelta(runLogDiff.changes.lint.items_delta)}
                </span>
              </div>
              <div className="mt-2 text-zinc-300">seed hosts</div>
              <div className="mt-1 text-zinc-400">
                added:{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.seed_hosts_changed.added.length > 0
                    ? runLogDiff.changes.seed_hosts_changed.added.join(", ")
                    : "none"}
                </span>
              </div>
              <div className="mt-1 text-zinc-400">
                removed:{" "}
                <span className="text-zinc-200">
                  {runLogDiff.changes.seed_hosts_changed.removed.length > 0
                    ? runLogDiff.changes.seed_hosts_changed.removed.join(", ")
                    : "none"}
                </span>
              </div>
            </div>
          ) : null}

          {selectedRunLog ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-zinc-200">Decision Trace</div>
              <div className="mt-1 font-mono text-[11px] text-zinc-400">
                run_id: {selectedRunLog.run_id}
              </div>
              {selectedTrace.length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500">No decision trace for this run.</div>
              ) : (
                <ul className="mt-2 space-y-2 text-xs text-zinc-300">
                  {selectedTrace.map((entry, index) => (
                    <li key={`${entry.code}-${index}`} className="rounded border border-zinc-800 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={getSeverityBadgeClass(entry.severity)}>
                          {entry.severity}
                        </span>
                        <span className="font-mono text-zinc-200">{entry.code}</span>
                      </div>
                      <div className="mt-1 text-zinc-300">{entry.message}</div>
                      {entry.evidence_refs && entry.evidence_refs.length > 0 ? (
                        <div className="mt-1 text-zinc-500">
                          evidence: {entry.evidence_refs.join(", ")}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {selectedRunLog ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="text-zinc-200">Evidence</div>
              {selectedRunEvidenceError ? (
                <div className="mt-2 text-xs text-amber-300">{selectedRunEvidenceError}</div>
              ) : null}
              {selectedRunEvidence ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-xs text-zinc-300">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-zinc-400">
                        <th className="px-2 py-1">kind</th>
                        <th className="px-2 py-1">artifact_id</th>
                        <th className="px-2 py-1">sha256</th>
                        <th className="px-2 py-1">bytes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRunEvidence.artifacts.map((artifact) => (
                        <tr key={artifact.id} className="border-b border-zinc-900/80">
                          <td className="px-2 py-1">{artifact.kind}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">{artifact.id}</td>
                          <td className="px-2 py-1 font-mono text-[11px]">
                            {artifact.sha256.slice(0, 12)}
                          </td>
                          <td className="px-2 py-1">{artifact.bytes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-2 text-xs text-zinc-500">No evidence index loaded.</div>
              )}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-zinc-200">Evidence Bundle</div>
              <button
                type="button"
                disabled={!activeBundleRunId || bundleExporting}
                onClick={() => {
                  if (!activeBundleRunId) {
                    return;
                  }
                  void onExportEvidenceBundle(activeBundleRunId);
                }}
                className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bundleExporting ? "Downloading..." : "Download Bundle"}
              </button>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              selected_run: {activeBundleRunId ?? "n/a"}
            </div>

            <div className="mt-3 grid gap-3">
              <label className="text-xs text-zinc-400">
                Upload bundle (.json, max 2MB)
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    void handleBundleFileLoad(file);
                    event.currentTarget.value = "";
                  }}
                  className="mt-1 block w-full text-xs text-zinc-300 file:mr-3 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-950 file:px-2 file:py-1 file:text-zinc-200"
                />
              </label>

              <label className="text-xs text-zinc-400">
                Paste bundle JSON
                <textarea
                  value={bundleText}
                  onChange={(event) => {
                    handleBundleTextChange(event.target.value);
                  }}
                  className="mt-1 min-h-[130px] w-full rounded-md border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-200"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!bundleDraft || bundleImporting || Boolean(bundleDraftError)}
                  onClick={() => {
                    void handleBundleImport();
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bundleImporting ? "Importing..." : "Import Bundle"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBundleText("");
                    setBundleInputStatus(null);
                    onClearBundleDraft();
                  }}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500"
                >
                  Clear
                </button>
              </div>

              {bundleDraft ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2 text-xs text-zinc-300">
                  <div>bundle_version: {bundleDraft.bundle_version}</div>
                  <div>run_id: {bundleDraft.run_id}</div>
                  <div>artifacts: {bundleDraft.evidence_index.artifacts.length}</div>
                  <ul className="mt-2 list-disc pl-5 text-zinc-400">
                    {bundlePreviewItems.map((artifact) => (
                      <li key={artifact.id}>
                        {artifact.id} ({artifact.kind}, {artifact.bytes} bytes)
                      </li>
                    ))}
                    {bundleDraft.evidence_index.artifacts.length > bundlePreviewItems.length ? (
                      <li>... {bundleDraft.evidence_index.artifacts.length - bundlePreviewItems.length} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {bundleInputStatus ? (
                <div className="text-xs text-zinc-400">{bundleInputStatus}</div>
              ) : null}
              {bundleDraftError ? (
                <div className="text-xs text-amber-300">{bundleDraftError}</div>
              ) : null}
              {bundleImportError ? (
                <div className="text-xs text-rose-300">{bundleImportError}</div>
              ) : null}
              {bundleImportOk ? (
                <div className="text-xs text-emerald-300">{bundleImportOk}</div>
              ) : null}
            </div>
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
