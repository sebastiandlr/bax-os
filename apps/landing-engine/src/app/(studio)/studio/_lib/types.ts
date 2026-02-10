import type { BuildSpecV0, BuildSpecV0CapabilityId } from "@bax/buildspec";
import type { RadiographyOutputV0 } from "@bax/radiography-contract";

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

export type LoadSpecSource = "default" | "example";
