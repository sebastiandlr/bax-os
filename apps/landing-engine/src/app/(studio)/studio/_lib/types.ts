import type { BuildSpecV0, BuildSpecV0CapabilityId } from "@bax/buildspec";
import type {
  DecisionTraceEntryV0,
  RadiographyOutputV0,
  RadiographyRunLogV0
} from "@bax/radiography-contract";

export type Source = "local" | "example";
export type Tab = "form" | "json";

export type ValidationState =
  | { ok: true; spec: BuildSpecV0 }
  | { ok: false; errors: string[] };

export type BuildSpecResponse = { source: Source; jsonText: string };

export type BuildSpecMode = BuildSpecV0["mode"];
export type CapabilityId = BuildSpecV0CapabilityId;

export type RadiographyInputsState = {
  business_name: string;
  city: string;
  country: string;
  language: string;
  seed_urls_text: string;
};

export type RadiographyView = RadiographyOutputV0;
export type RadiographyRunLog = RadiographyRunLogV0;
export type DecisionTraceEntry = DecisionTraceEntryV0;

export type EvidenceArtifact = {
  id: string;
  kind: "inputs_summary" | "gating" | "debug";
  sha256: string;
  bytes: number;
  created_at: string;
};

export type EvidenceIndex = {
  run_id: string;
  created_at: string;
  artifacts: EvidenceArtifact[];
};

export type EvidenceBundleArtifact = {
  id: string;
  kind: string;
  sha256: string;
  bytes: number;
  created_at: string;
  content?: unknown;
};

export type EvidenceBundleDraft = {
  bundle_version: string;
  run_id: string;
  created_at: string;
  evidence_index: {
    run_id: string;
    created_at: string;
    artifacts: EvidenceBundleArtifact[];
  };
  artifacts: EvidenceBundleArtifact[];
};

export type RunLogListItem = {
  run_id: string;
  created_at: string;
  duration_ms: number;
  status: "pass" | "soft_fail" | "hard_fail" | "blocked";
  core_percent: number;
  reason_codes: string[];
  seed_urls_count: number;
  unique_hosts_count: number;
  source?: "local_run" | "imported_bundle";
  is_stub?: boolean;
  top_blockers?: string[];
};

export type RunLogDiff = {
  ok: true;
  from: string;
  to: string;
  changes: {
    gating: {
      from: {
        status: "pass" | "soft_fail" | "hard_fail";
        core_percent: number;
        reason_codes: string[];
      };
      to: {
        status: "pass" | "soft_fail" | "hard_fail";
        core_percent: number;
        reason_codes: string[];
      };
    };
    blockers: { added: string[]; removed: string[] };
    patch_ops_count: { from: number; to: number; delta: number };
    provenance_coverage_percent: { from: number; to: number; delta: number };
    lint: { hard_delta: number; warn_delta: number; items_delta: number };
    capabilities_changed: { added: string[]; removed: string[] };
    seed_hosts_changed: { added: string[]; removed: string[] };
  };
};

export type LoadSpecSource = "default" | "example";
