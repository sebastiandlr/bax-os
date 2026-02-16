import type { BuildSpecV0, BuildSpecV0CapabilityId } from "@bax/buildspec";
import type {
  RadiographyOutputV0,
  RadiographyRunLogV0,
  ReasonCodeV0
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

export type RunLogListItem = {
  run_id: string;
  created_at: string;
  duration_ms: number;
  status: "pass" | "soft_fail" | "hard_fail" | "blocked";
  core_percent: number;
  reason_codes: string[];
  seed_urls_count: number;
  unique_hosts_count: number;
  top_blockers?: ReasonCodeV0[];
};

export type LoadSpecSource = "default" | "example";
