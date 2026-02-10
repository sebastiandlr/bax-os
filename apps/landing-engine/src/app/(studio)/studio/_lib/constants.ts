import { BuildSpecV0Schema } from "@bax/buildspec";
import exampleSpec from "@/content/specs/buildspec.v0.example.json";
import type { RadiographyInputsState } from "./types";

export const EVENT_SCHEMA_VERSION = "0.1.0" as const;

export const DEFAULT_SPEC = BuildSpecV0Schema.parse(exampleSpec);

export const RADIOGRAPHY_INPUTS_STORAGE_KEY = "bax_radiography_inputs_v0";

export const DEFAULT_RADIOGRAPHY_INPUTS: RadiographyInputsState = {
  business_name: "PLACEHOLDER: BAX Demo",
  city: "PLACEHOLDER: CDMX",
  country: "MX",
  language: "es",
  seed_urls_text: ""
};
