import { useEffect, useMemo, useState } from "react";
import { runRadiographyV0 } from "@bax/radiography-runner";
import {
  RadiographyRunLogV0Schema,
  type ReasonCodeV0
} from "@bax/radiography-contract";
import type {
  RadiographyInputsState,
  RadiographyRunLog,
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
  latestRunSummary: RunSummary | null;
  isLatestRunLogOpen: boolean;
  latestRunLogText: string;
  handleExportRadiography: () => void;
  handleOpenLatestRunLog: () => Promise<void>;
  handleDownloadLatestRunLog: () => Promise<void>;
  handleCloseLatestRunLog: () => void;
};

const fnv1a = (value: string, seed: number): string => {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const hashUrlDeterministic = (url: string): string => {
  return `${fnv1a(url, 0x811c9dc5)}${fnv1a(url, 0x9e3779b1)}`;
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
  return [...hosts];
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

export const useRadiographyView = ({
  validation,
  radiographyInputs,
  seedUrls
}: UseRadiographyViewArgs): RadiographyViewController => {
  const [isLatestRunLogOpen, setIsLatestRunLogOpen] = useState(false);
  const [latestRunLogText, setLatestRunLogText] = useState("");

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
      run_id: radiographyView.run_metadata.run_id,
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
          url_hashes: seedUrls.map((url) => hashUrlDeterministic(url))
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

  useEffect(() => {
    if (!currentRunLog) {
      return;
    }

    void fetch("/api/radiography/runlog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runlog: currentRunLog })
    });
  }, [currentRunLog]);

  const latestRunSummary = currentRunLog
    ? {
        run_id: currentRunLog.run_id,
        created_at: currentRunLog.created_at,
        duration_ms: currentRunLog.duration_ms
      }
    : null;

  const readLatestRunLog = async (): Promise<RadiographyRunLog | null> => {
    const response = await fetch("/api/radiography/runlog/latest", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to fetch latest run log");
    }

    const body = (await response.json()) as unknown;
    return parseLatestRunLogResponse(body);
  };

  const handleOpenLatestRunLog = async () => {
    try {
      const latest = await readLatestRunLog();
      if (!latest) {
        setLatestRunLogText("No run logs yet.\n");
      } else {
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
    latestRunSummary,
    isLatestRunLogOpen,
    latestRunLogText,
    handleExportRadiography,
    handleOpenLatestRunLog,
    handleDownloadLatestRunLog,
    handleCloseLatestRunLog
  };
};
