import { useCallback, useEffect, useMemo, useState } from "react";
import { runRadiographyV0 } from "@bax/radiography-runner";
import {
  RadiographyRunLogV0Schema,
  type ReasonCodeV0
} from "@bax/radiography-contract";
import type {
  EvidenceBundleDraft,
  EvidenceIndex,
  RadiographyInputsState,
  RunLogDiff,
  RadiographyRunLog,
  RunLogListItem,
  RadiographyView,
  ValidationState
} from "../_lib/types";

type UseRadiographyViewArgs = {
  validation: ValidationState;
  radiographyInputs: RadiographyInputsState;
  seedUrls: string[];
};

type RunSummary = {
  run_id: string;
  created_at: string;
  duration_ms: number;
};

export type RadiographyViewController = {
  hasValidSpec: boolean;
  hasSeedUrls: boolean;
  canRunRadiography: boolean;
  radiographyView: RadiographyView | null;
  currentRunLog: RadiographyRunLog | null;
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
  handleExportRadiography: () => void;
  exportEvidenceBundle: (runId: string) => Promise<void>;
  importEvidenceBundle: (bundle: unknown) => Promise<{ run_id: string }>;
  setBundleDraftFromText: (jsonText: string) => void;
  setBundleDraftFromUnknown: (value: unknown) => void;
  clearBundleDraft: () => void;
  handleOpenLatestRunLog: () => Promise<void>;
  handleDownloadLatestRunLog: () => Promise<void>;
  handleRefreshRunLogs: () => Promise<void>;
  handleOpenRunLogById: (runId: string) => Promise<void>;
  handleDownloadRunLogById: (runId: string) => Promise<void>;
  handlePruneRunLogs: (maxFiles: number, maxAgeDays: number) => Promise<void>;
  handleReplayRunLog: (
    runId: string,
    seedUrlsRaw: string[],
    mode: "persist" | "dry_run"
  ) => Promise<void>;
  handleComputeRunLogDiff: (fromRunId: string, toRunId: string) => Promise<void>;
  handleCloseLatestRunLog: () => void;
};

const createRunId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
      // Ignore invalid URL strings for host extraction.
    }
  }
  return [...hosts].sort();
};

const getTopReasonCodes = (view: RadiographyView): ReasonCodeV0[] => {
  const counts = new Map<ReasonCodeV0, number>();
  for (const item of view.lint_report) {
    counts.set(item.reason_code, (counts.get(item.reason_code) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reasonCode]) => reasonCode);
};

const downloadJson = (fileName: string, data: unknown) => {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const parseLatestRunLogResponse = (body: unknown): RadiographyRunLog | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const maybe = body as { ok?: unknown; runlog?: unknown; reason?: unknown };
  if (maybe.ok === false && maybe.reason === "none") {
    return null;
  }
  if (maybe.ok !== true) {
    return null;
  }

  const parsed = RadiographyRunLogV0Schema.safeParse(maybe.runlog);
  return parsed.success ? parsed.data : null;
};

const parseRunLogResponse = (
  body: unknown
): { runlog: RadiographyRunLog | null; reason: string | null } => {
  if (!body || typeof body !== "object") {
    return { runlog: null, reason: "invalid" };
  }

  const maybe = body as { ok?: unknown; runlog?: unknown; reason?: unknown };
  if (maybe.ok !== true) {
    return {
      runlog: null,
      reason: typeof maybe.reason === "string" ? maybe.reason : "invalid"
    };
  }

  const parsed = RadiographyRunLogV0Schema.safeParse(maybe.runlog);
  if (!parsed.success) {
    return { runlog: null, reason: "invalid" };
  }
  return { runlog: parsed.data, reason: null };
};

const isRunLogListItem = (value: unknown): value is RunLogListItem => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.run_id === "string" &&
    typeof item.created_at === "string" &&
    typeof item.duration_ms === "number" &&
    (item.status === "pass" ||
      item.status === "soft_fail" ||
      item.status === "hard_fail" ||
      item.status === "blocked") &&
    typeof item.core_percent === "number" &&
    Array.isArray(item.reason_codes) &&
    item.reason_codes.every((code) => typeof code === "string") &&
    typeof item.seed_urls_count === "number" &&
    typeof item.unique_hosts_count === "number" &&
    (item.top_blockers === undefined ||
      (Array.isArray(item.top_blockers) &&
        item.top_blockers.every((code) => typeof code === "string")))
  );
};

const parseRunLogListResponse = (
  body: unknown
): { ok: true; items: RunLogListItem[] } | { ok: false } => {
  if (!body || typeof body !== "object") {
    return { ok: false };
  }

  const maybe = body as { ok?: unknown; items?: unknown };
  if (maybe.ok !== true || !Array.isArray(maybe.items)) {
    return { ok: false };
  }

  return {
    ok: true,
    items: maybe.items.filter(isRunLogListItem)
  };
};

const isEvidenceArtifact = (
  value: unknown
): value is EvidenceIndex["artifacts"][number] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact.id === "string" &&
    (artifact.kind === "inputs_summary" ||
      artifact.kind === "gating" ||
      artifact.kind === "debug") &&
    typeof artifact.sha256 === "string" &&
    typeof artifact.bytes === "number" &&
    typeof artifact.created_at === "string"
  );
};

const parseEvidenceIndexResponse = (
  body: unknown
): { ok: true; evidenceIndex: EvidenceIndex } | { ok: false; reason: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "invalid" };
  }

  const maybe = body as {
    ok?: unknown;
    reason?: unknown;
    evidence_index?: unknown;
  };

  if (maybe.ok !== true) {
    return {
      ok: false,
      reason: typeof maybe.reason === "string" ? maybe.reason : "invalid"
    };
  }

  if (!maybe.evidence_index || typeof maybe.evidence_index !== "object") {
    return { ok: false, reason: "invalid" };
  }

  const index = maybe.evidence_index as Record<string, unknown>;
  if (
    typeof index.run_id !== "string" ||
    typeof index.created_at !== "string" ||
    !Array.isArray(index.artifacts) ||
    !index.artifacts.every(isEvidenceArtifact)
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    evidenceIndex: {
      run_id: index.run_id,
      created_at: index.created_at,
      artifacts: index.artifacts
    }
  };
};

const isEvidenceBundleArtifact = (value: unknown): value is EvidenceBundleDraft["artifacts"][number] => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact.id === "string" &&
    typeof artifact.kind === "string" &&
    typeof artifact.sha256 === "string" &&
    typeof artifact.bytes === "number" &&
    typeof artifact.created_at === "string"
  );
};

const parseEvidenceBundleDraft = (value: unknown): EvidenceBundleDraft | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const bundle = value as Record<string, unknown>;
  if (
    typeof bundle.bundle_version !== "string" ||
    typeof bundle.run_id !== "string" ||
    typeof bundle.created_at !== "string" ||
    !bundle.evidence_index ||
    typeof bundle.evidence_index !== "object" ||
    !Array.isArray(bundle.artifacts)
  ) {
    return null;
  }

  const evidenceIndex = bundle.evidence_index as Record<string, unknown>;
  if (
    typeof evidenceIndex.run_id !== "string" ||
    typeof evidenceIndex.created_at !== "string" ||
    !Array.isArray(evidenceIndex.artifacts)
  ) {
    return null;
  }

  if (
    !bundle.artifacts.every(isEvidenceBundleArtifact) ||
    !evidenceIndex.artifacts.every(isEvidenceBundleArtifact)
  ) {
    return null;
  }

  return {
    bundle_version: bundle.bundle_version,
    run_id: bundle.run_id,
    created_at: bundle.created_at,
    evidence_index: {
      run_id: evidenceIndex.run_id,
      created_at: evidenceIndex.created_at,
      artifacts: evidenceIndex.artifacts
    },
    artifacts: bundle.artifacts
  };
};

const sanitizeImportErrorMessage = (status: number): string => {
  if (status === 409) {
    return "Run already exists. Change bundle.run_id + evidence_index.run_id to import as new run.";
  }
  if (status === 413) {
    return "Bundle too large. Reduce bundle size or raise limit.";
  }
  if (status === 422) {
    return "Bundle invalid or evidence integrity failed (sha/bytes/kind mismatch).";
  }
  if (status === 400) {
    return "Malformed request.";
  }
  return "Server error. Check logs.";
};

const parseRunLogDiffResponse = (body: unknown): RunLogDiff | null => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = body as Record<string, unknown>;
  if (value.ok !== true) {
    return null;
  }

  if (typeof value.from !== "string" || typeof value.to !== "string") {
    return null;
  }

  if (!value.changes || typeof value.changes !== "object") {
    return null;
  }

  return value as RunLogDiff;
};

export const useRadiographyView = ({
  validation,
  radiographyInputs,
  seedUrls
}: UseRadiographyViewArgs): RadiographyViewController => {
  const [runLogWarning, setRunLogWarning] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunLog, setSelectedRunLog] = useState<RadiographyRunLog | null>(null);
  const [selectedRunEvidence, setSelectedRunEvidence] = useState<EvidenceIndex | null>(null);
  const [selectedRunEvidenceError, setSelectedRunEvidenceError] = useState<string | null>(null);
  const [runLogDiff, setRunLogDiff] = useState<RunLogDiff | null>(null);
  const [isLatestRunLogOpen, setIsLatestRunLogOpen] = useState(false);
  const [runLogViewerTitle, setRunLogViewerTitle] = useState("Latest Run Log");
  const [latestRunLogText, setLatestRunLogText] = useState("");
  const [runLogList, setRunLogList] = useState<RunLogListItem[]>([]);
  const [isRunLogListLoading, setIsRunLogListLoading] = useState(false);
  const [runLogListError, setRunLogListError] = useState<string | null>(null);
  const [isRunLogPruneLoading, setIsRunLogPruneLoading] = useState(false);
  const [isRunLogReplayLoading, setIsRunLogReplayLoading] = useState(false);
  const [isRunLogDiffLoading, setIsRunLogDiffLoading] = useState(false);
  const [bundleExporting, setBundleExporting] = useState(false);
  const [bundleImporting, setBundleImporting] = useState(false);
  const [bundleImportError, setBundleImportError] = useState<string | null>(null);
  const [bundleImportOk, setBundleImportOk] = useState<string | null>(null);
  const [bundleDraft, setBundleDraft] = useState<EvidenceBundleDraft | null>(null);
  const [bundleDraftError, setBundleDraftError] = useState<string | null>(null);
  const [runLogOpsMessage, setRunLogOpsMessage] = useState<string | null>(null);

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
          run_id: createRunId(),
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

  const currentRunLog = useMemo<RadiographyRunLog | null>(() => {
    if (!radiographyView || !validation.ok) {
      return null;
    }

    const hardCount = radiographyView.lint_report.filter(
      (item) => item.severity === "hard_fail"
    ).length;
    const warnCount = radiographyView.lint_report.filter(
      (item) => item.severity === "warn"
    ).length;

    return {
      runlog_version: "0.1.0",
      run_id: createRunId(),
      created_at: new Date().toISOString(),
      duration_ms: radiographyView.run_metadata.duration_ms,
      inputs: {
        contractVersion: "0.1.0",
        business_name: radiographyInputs.business_name,
        city: radiographyInputs.city,
        country: radiographyInputs.country,
        language: radiographyInputs.language,
        mode_hint: validation.spec.mode,
        seed_urls: {
          count: seedUrls.length,
          unique_hosts: parseUniqueHosts(seedUrls),
          url_hashes: []
        }
      },
      buildspec: {
        schemaVersion: validation.spec.schemaVersion,
        eventSchemaVersion: validation.spec.eventSchemaVersion,
        mode: validation.spec.mode,
        capabilities: validation.spec.capabilities,
        metadata: validation.spec.metadata
      },
      outputs: {
        gating_decision: radiographyView.gating_decision,
        lint_report: {
          items_count: radiographyView.lint_report.length,
          hard_count: hardCount,
          warn_count: warnCount,
          top_reason_codes: getTopReasonCodes(radiographyView)
        },
        patch_stats: {
          ops_count: radiographyView.business_dna_patch.length
        },
        provenance_coverage_percent:
          radiographyView.run_metadata.provenance_coverage_percent
      }
    };
  }, [radiographyInputs, radiographyView, seedUrls, validation]);

  const fetchRunLogList = useCallback(async (limit = 20) => {
    setIsRunLogListLoading(true);
    setRunLogListError(null);

    try {
      const response = await fetch(`/api/radiography/runlog?limit=${limit}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch run log list");
      }

      const body = (await response.json()) as unknown;
      const parsed = parseRunLogListResponse(body);
      if (!parsed.ok) {
        throw new Error("Invalid run log list response");
      }

      setRunLogList(parsed.items);
      setRunLogListError(null);
    } catch {
      setRunLogListError("Unable to load run logs.");
    } finally {
      setIsRunLogListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRunLogList();
  }, [fetchRunLogList]);

  const latestRunSummary = currentRunLog
    ? {
        run_id: currentRunLog.run_id,
        created_at: currentRunLog.created_at,
        duration_ms: currentRunLog.duration_ms
      }
    : null;

  const readLatestRunLog = useCallback(async (): Promise<RadiographyRunLog | null> => {
    const response = await fetch("/api/radiography/runlog/latest", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch latest run log");
    }

    const body = (await response.json()) as unknown;
    return parseLatestRunLogResponse(body);
  }, []);

  const readRunLogById = useCallback(async (
    runId: string
  ): Promise<{ runlog: RadiographyRunLog | null; reason: string | null }> => {
    const response = await fetch(`/api/radiography/runlog/${encodeURIComponent(runId)}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch run log");
    }

    const body = (await response.json()) as unknown;
    return parseRunLogResponse(body);
  }, []);

  const fetchEvidenceByRunId = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    setSelectedRunEvidence(null);
    setSelectedRunEvidenceError(null);

    try {
      const response = await fetch(
        `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}`,
        { cache: "no-store" }
      );

      const body = (await response.json()) as unknown;
      const parsed = parseEvidenceIndexResponse(body);

      if (!response.ok || !parsed.ok) {
        if (!parsed.ok && parsed.reason === "not_found") {
          setSelectedRunEvidenceError("No evidence pack found for this run.");
          return;
        }
        throw new Error("Failed to load evidence pack");
      }

      setSelectedRunEvidence(parsed.evidenceIndex);
      setSelectedRunEvidenceError(null);
    } catch {
      setSelectedRunEvidenceError("Unable to load evidence pack.");
    }
  }, []);

  const setBundleDraftFromUnknown = useCallback((value: unknown) => {
    const parsed = parseEvidenceBundleDraft(value);
    if (!parsed) {
      setBundleDraft(null);
      setBundleDraftError("Bundle JSON is invalid or missing required fields.");
      return;
    }

    setBundleDraft(parsed);
    setBundleDraftError(null);
    setBundleImportError(null);
  }, []);

  const setBundleDraftFromText = useCallback((jsonText: string) => {
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setBundleDraft(null);
      setBundleDraftError(null);
      setBundleImportError(null);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      setBundleDraftFromUnknown(parsed);
    } catch {
      setBundleDraft(null);
      setBundleDraftError("Bundle JSON is not valid.");
    }
  }, [setBundleDraftFromUnknown]);

  const clearBundleDraft = useCallback(() => {
    setBundleDraft(null);
    setBundleDraftError(null);
    setBundleImportError(null);
    setBundleImportOk(null);
  }, []);

  useEffect(() => {
    if (!currentRunLog) {
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const response = await fetch("/api/radiography/runlog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runlog: currentRunLog,
            seed_urls_raw: seedUrls
          })
        });

        if (!response.ok) {
          if (mounted) {
            setRunLogWarning("Run log persistence failed (best-effort).");
          }
          return;
        }

        const body = (await response.json()) as unknown;
        const persistedRunId =
          body && typeof body === "object" && typeof (body as { run_id?: unknown }).run_id === "string"
            ? (body as { run_id: string }).run_id
            : null;

        if (mounted) {
          setRunLogWarning(null);
          if (persistedRunId) {
            const result = await readRunLogById(persistedRunId);
            if (result.runlog) {
              setSelectedRunLog(result.runlog);
              setRunLogDiff(null);
              await fetchEvidenceByRunId(result.runlog.run_id);
            }
          }
          await fetchRunLogList();
        }
      } catch {
        if (mounted) {
          setRunLogWarning("Run log persistence failed (best-effort).");
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [currentRunLog, fetchEvidenceByRunId, fetchRunLogList, readRunLogById, seedUrls]);

  const exportEvidenceBundle = useCallback(async (runId: string) => {
    if (!runId) {
      setRunLogOpsMessage("Select a run before exporting a bundle.");
      return;
    }

    setBundleExporting(true);
    setRunLogOpsMessage(null);

    try {
      const response = await fetch(
        `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/bundle`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setRunLogOpsMessage("No evidence bundle found for the selected run.");
          return;
        }
        if (response.status === 409 || response.status === 422) {
          setRunLogOpsMessage("Evidence integrity check failed. Bundle export blocked.");
          return;
        }
        if (response.status === 413) {
          setRunLogOpsMessage("Bundle too large to export.");
          return;
        }
        setRunLogOpsMessage("Bundle export failed.");
        return;
      }

      const body = (await response.json()) as unknown;
      const bundle = parseEvidenceBundleDraft(body);
      if (!bundle) {
        setRunLogOpsMessage("Bundle export failed.");
        return;
      }

      downloadJson(`${bundle.run_id}.evidence.bundle.json`, bundle);
      setRunLogOpsMessage(`Evidence bundle downloaded for ${bundle.run_id}.`);
    } catch {
      setRunLogOpsMessage("Bundle export failed.");
    } finally {
      setBundleExporting(false);
    }
  }, []);

  const importEvidenceBundle = useCallback(async (bundle: unknown): Promise<{ run_id: string }> => {
    const parsedDraft = parseEvidenceBundleDraft(bundle);
    if (!parsedDraft) {
      const message = "Bundle JSON is invalid or missing required fields.";
      setBundleImportError(message);
      throw new Error(message);
    }

    setBundleImporting(true);
    setBundleImportError(null);
    setBundleImportOk(null);
    setRunLogOpsMessage(null);

    try {
      const response = await fetch("/api/radiography/runlog/evidence/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({ bundle: parsedDraft })
      });

      if (!response.ok) {
        const message = sanitizeImportErrorMessage(response.status);
        setBundleImportError(message);
        throw new Error(message);
      }

      const body = (await response.json()) as unknown;
      if (!body || typeof body !== "object") {
        const message = "Malformed request.";
        setBundleImportError(message);
        throw new Error(message);
      }

      const result = body as {
        ok?: unknown;
        run_id?: unknown;
        imported?: {
          artifacts?: unknown;
        };
      };

      if (result.ok !== true || typeof result.run_id !== "string") {
        const message = "Malformed request.";
        setBundleImportError(message);
        throw new Error(message);
      }

      setBundleImportOk(`Bundle imported for ${result.run_id}.`);
      setBundleImportError(null);
      setSelectedRunLog(null);
      setRunLogDiff(null);
      await fetchRunLogList();
      setSelectedRunId(result.run_id);
      await fetchEvidenceByRunId(result.run_id);
      return { run_id: result.run_id };
    } catch (error) {
      setBundleImportError(
        error instanceof Error && error.message
          ? error.message
          : "Server error. Check logs."
      );
      throw error;
    } finally {
      setBundleImporting(false);
    }
  }, [fetchEvidenceByRunId, fetchRunLogList]);

  const handleOpenLatestRunLog = async () => {
    try {
      const latest = await readLatestRunLog();
      setRunLogViewerTitle("Latest Run Log");
      if (!latest) {
        setSelectedRunId(null);
        setSelectedRunLog(null);
        setSelectedRunEvidence(null);
        setSelectedRunEvidenceError(null);
        setRunLogDiff(null);
        setLatestRunLogText("No run logs yet.\n");
      } else {
        setSelectedRunLog(latest);
        setRunLogDiff(null);
        await fetchEvidenceByRunId(latest.run_id);
        setLatestRunLogText(`${JSON.stringify(latest, null, 2)}\n`);
      }
      setIsLatestRunLogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load run log";
      setLatestRunLogText(`${message}\n`);
      setIsLatestRunLogOpen(true);
    }
  };

  const handleDownloadLatestRunLog = async () => {
    try {
      const latest = await readLatestRunLog();
      if (!latest) {
        return;
      }
      downloadJson(`radiography.runlog.${latest.run_id}.json`, latest);
    } catch {
      // Keep UI deterministic; failing to download latest should not break panel.
    }
  };

  const handleRefreshRunLogs = async () => {
    await fetchRunLogList();
  };

  const handlePruneRunLogs = async (maxFiles: number, maxAgeDays: number) => {
    setIsRunLogPruneLoading(true);
    setRunLogOpsMessage(null);

    try {
      const response = await fetch("/api/radiography/runlog/prune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxFiles, maxAgeDays })
      });

      const body = (await response.json()) as unknown;
      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Prune request failed");
      }

      const result = body as {
        ok?: unknown;
        deleted?: unknown;
        kept?: unknown;
        scanned?: unknown;
      };

      if (
        result.ok !== true ||
        typeof result.deleted !== "number" ||
        typeof result.kept !== "number" ||
        typeof result.scanned !== "number"
      ) {
        throw new Error("Invalid prune response");
      }

      setRunLogOpsMessage(
        `Pruned run logs. Deleted ${result.deleted} (Kept ${result.kept}, Scanned ${result.scanned}).`
      );
      await fetchRunLogList();
    } catch {
      setRunLogOpsMessage("Run log prune failed (non-blocking).");
    } finally {
      setIsRunLogPruneLoading(false);
    }
  };

  const handleReplayRunLog = async (
    runId: string,
    seedUrlsRaw: string[],
    mode: "persist" | "dry_run"
  ) => {
    setIsRunLogReplayLoading(true);
    setRunLogOpsMessage(null);

    try {
      const normalizedSeedUrls = seedUrlsRaw
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      if (normalizedSeedUrls.length === 0) {
        setRunLogOpsMessage("Replay blocked: provide at least one seed URL.");
        return;
      }

      const response = await fetch("/api/radiography/runlog/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          seed_urls_override: normalizedSeedUrls,
          mode
        })
      });

      const body = (await response.json()) as unknown;
      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Replay request failed");
      }

      const result = body as {
        ok?: unknown;
        new_run_id?: unknown;
        runlog?: unknown;
      };

      if (result.ok !== true || typeof result.new_run_id !== "string") {
        throw new Error("Replay request failed");
      }

      setRunLogOpsMessage(
        `Replay complete: ${result.new_run_id} (${mode === "dry_run" ? "dry-run" : "persisted"}).`
      );

      const parsedRunlog = RadiographyRunLogV0Schema.safeParse(result.runlog);
      if (parsedRunlog.success) {
        setSelectedRunLog(parsedRunlog.data);
        setRunLogDiff(null);
        if (mode === "persist") {
          await fetchEvidenceByRunId(parsedRunlog.data.run_id);
        } else {
          setSelectedRunEvidence(null);
          setSelectedRunEvidenceError("No evidence pack for dry-run replay.");
        }
        setRunLogViewerTitle(`Replay ${parsedRunlog.data.run_id}`);
        setLatestRunLogText(`${JSON.stringify(parsedRunlog.data, null, 2)}\n`);
        setIsLatestRunLogOpen(true);
      }

      if (mode !== "dry_run") {
        await fetchRunLogList();
      }
    } catch {
      setRunLogOpsMessage("Run log replay failed (non-blocking).");
    } finally {
      setIsRunLogReplayLoading(false);
    }
  };

  const handleComputeRunLogDiff = async (fromRunId: string, toRunId: string) => {
    setIsRunLogDiffLoading(true);
    setRunLogOpsMessage(null);

    try {
      if (!fromRunId || !toRunId) {
        setRunLogOpsMessage("Diff blocked: select both run IDs.");
        return;
      }

      const response = await fetch(
        `/api/radiography/runlog/diff?from=${encodeURIComponent(fromRunId)}&to=${encodeURIComponent(toRunId)}`,
        { cache: "no-store" }
      );

      const body = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error("Diff request failed");
      }

      const diff = parseRunLogDiffResponse(body);
      if (!diff) {
        throw new Error("Invalid diff response");
      }

      setRunLogDiff(diff);
      setRunLogViewerTitle(`RunLog Diff ${diff.from} -> ${diff.to}`);
      setLatestRunLogText(`${JSON.stringify(diff, null, 2)}\n`);
      setIsLatestRunLogOpen(true);
      setRunLogOpsMessage("Run log diff computed.");
    } catch {
      setRunLogOpsMessage("Run log diff failed (non-blocking).");
    } finally {
      setIsRunLogDiffLoading(false);
    }
  };

  const handleOpenRunLogById = async (runId: string) => {
    try {
      const result = await readRunLogById(runId);
      setRunLogViewerTitle(`Run Log ${runId}`);
      if (!result.runlog) {
        setSelectedRunId(runId);
        setSelectedRunLog(null);
        setSelectedRunEvidence(null);
        setSelectedRunEvidenceError(
          result.reason === "not_found" ? "No evidence pack found for this run." : "Unable to load evidence pack."
        );
        setRunLogDiff(null);
        if (result.reason === "not_found") {
          setLatestRunLogText("Run log not found.\n");
        } else {
          setLatestRunLogText("Run log is invalid.\n");
        }
      } else {
        setSelectedRunLog(result.runlog);
        setRunLogDiff(null);
        await fetchEvidenceByRunId(result.runlog.run_id);
        setLatestRunLogText(`${JSON.stringify(result.runlog, null, 2)}\n`);
      }
      setIsLatestRunLogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load run log";
      setRunLogViewerTitle(`Run Log ${runId}`);
      setLatestRunLogText(`${message}\n`);
      setIsLatestRunLogOpen(true);
    }
  };

  const handleDownloadRunLogById = async (runId: string) => {
    try {
      const result = await readRunLogById(runId);
      if (!result.runlog) {
        return;
      }
      downloadJson(`radiography-runlog-${result.runlog.run_id}.json`, result.runlog);
    } catch {
      // Keep UI deterministic; failures should not break other Studio actions.
    }
  };

  const handleCloseLatestRunLog = () => {
    setIsLatestRunLogOpen(false);
  };

  const handleExportRadiography = () => {
    if (!radiographyView) {
      return;
    }

    downloadJson("radiography.v0.json", radiographyView);
  };

  return {
    hasValidSpec,
    hasSeedUrls,
    canRunRadiography,
    radiographyView,
    currentRunLog,
    selectedRunId,
    selectedRunLog,
    selectedRunEvidence,
    selectedRunEvidenceError,
    runLogDiff,
    latestRunSummary,
    runLogWarning: canRunRadiography ? runLogWarning : null,
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
    handleExportRadiography,
    exportEvidenceBundle,
    importEvidenceBundle,
    setBundleDraftFromText,
    setBundleDraftFromUnknown,
    clearBundleDraft,
    handleOpenLatestRunLog,
    handleDownloadLatestRunLog,
    handleRefreshRunLogs,
    handleOpenRunLogById,
    handleDownloadRunLogById,
    handlePruneRunLogs,
    handleReplayRunLog,
    handleComputeRunLogDiff,
    handleCloseLatestRunLog
  };
};
