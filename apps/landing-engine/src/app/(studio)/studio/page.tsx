"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BuildSpecV0Schema,
  CAPABILITY_IDS_V0,
  type BuildSpecV0,
  type BuildSpecV0CapabilityId,
} from "@bax/buildspec";
import { runRadiographyV0 } from "@bax/radiography-runner";
import exampleSpec from "@/content/specs/buildspec.v0.example.json";
import { formatZodIssues } from "@/lib/spec/formatZodIssues";

type Source = "local" | "example";
type Tab = "form" | "json";

type ValidationState =
  | { ok: true; spec: BuildSpecV0 }
  | { ok: false; errors: string[] };

type BuildSpecResponse = { source: Source; jsonText: string };

const DEFAULT_SPEC = BuildSpecV0Schema.parse(exampleSpec);

type RadiographyInputsState = {
  business_name: string;
  city: string;
  country: string;
  language: string;
  seed_urls_text: string;
};

const RADIOGRAPHY_INPUTS_STORAGE_KEY = "bax_radiography_inputs_v0";
const DEFAULT_RADIOGRAPHY_INPUTS: RadiographyInputsState = {
  business_name: "PLACEHOLDER: BAX Demo",
  city: "PLACEHOLDER: CDMX",
  country: "MX",
  language: "es",
  seed_urls_text: "",
};

type RadiographyView = ReturnType<typeof runRadiographyV0>;

const stringifySpec = (spec: BuildSpecV0): string => {
  return `${JSON.stringify(spec, null, 2)}\n`;
};

const parseSeedUrls = (text: string): string[] => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const validateJsonText = (jsonText: string): ValidationState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, errors: [`json: ${message}`] };
  }

  const result = BuildSpecV0Schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, errors: formatZodIssues(result.error.issues) };
  }

  return { ok: true, spec: result.data };
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string; errors?: string[] };
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors.join(" | ");
    }
    if (body.error) {
      return body.error;
    }
  } catch {
    // Ignore parse failures and fall through to generic message.
  }
  return "Request failed";
};

export default function StudioPage() {
  const [tab, setTab] = useState<Tab>("form");
  const [source, setSource] = useState<Source>("example");
  const [jsonText, setJsonText] = useState<string>(() => stringifySpec(DEFAULT_SPEC));
  const [lastValidSpec, setLastValidSpec] = useState<BuildSpecV0>(DEFAULT_SPEC);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [radiographyInputs, setRadiographyInputs] = useState<RadiographyInputsState>(
    DEFAULT_RADIOGRAPHY_INPUTS
  );

  const validation = useMemo(() => validateJsonText(jsonText), [jsonText]);
  const activeSpec = validation.ok ? validation.spec : lastValidSpec;
  const seedUrls = useMemo(
    () => parseSeedUrls(radiographyInputs.seed_urls_text),
    [radiographyInputs.seed_urls_text]
  );

  useEffect(() => {
    if (validation.ok) {
      setLastValidSpec(validation.spec);
    }
  }, [validation]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(RADIOGRAPHY_INPUTS_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<{
        business_name: unknown;
        city: unknown;
        country: unknown;
        language: unknown;
        seed_urls: unknown;
        seed_urls_text: unknown;
      }>;
      const seedUrlsFromArray = Array.isArray(parsed.seed_urls)
        ? parsed.seed_urls.filter((url): url is string => typeof url === "string")
        : [];
      const seedText =
        typeof parsed.seed_urls_text === "string"
          ? parsed.seed_urls_text
          : seedUrlsFromArray.join("\n");

      setRadiographyInputs({
        business_name:
          typeof parsed.business_name === "string"
            ? parsed.business_name
            : DEFAULT_RADIOGRAPHY_INPUTS.business_name,
        city:
          typeof parsed.city === "string"
            ? parsed.city
            : DEFAULT_RADIOGRAPHY_INPUTS.city,
        country:
          typeof parsed.country === "string"
            ? parsed.country
            : DEFAULT_RADIOGRAPHY_INPUTS.country,
        language:
          typeof parsed.language === "string"
            ? parsed.language
            : DEFAULT_RADIOGRAPHY_INPUTS.language,
        seed_urls_text: seedText,
      });
    } catch {
      // Ignore localStorage parse failures and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      business_name: radiographyInputs.business_name,
      city: radiographyInputs.city,
      country: radiographyInputs.country,
      language: radiographyInputs.language,
      seed_urls: seedUrls,
    };
    window.localStorage.setItem(
      RADIOGRAPHY_INPUTS_STORAGE_KEY,
      JSON.stringify(payload)
    );
  }, [radiographyInputs, seedUrls]);

  const loadSpec = useCallback(async (requestSource: "default" | "example") => {
    setLoading(true);
    setStatusMessage(null);

    const query = requestSource === "example" ? "?source=example" : "";
    const response = await fetch(`/api/buildspec${query}`, { cache: "no-store" });

    if (!response.ok) {
      setLoading(false);
      throw new Error(await parseApiError(response));
    }

    const data = (await response.json()) as BuildSpecResponse;
    setJsonText(data.jsonText);
    setSource(data.source);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const data = await loadSpec("default");
        if (!mounted) {
          return;
        }
        if (data.source === "example") {
          setStatusMessage("No local override. Loaded example.");
        }
      } catch (error) {
        if (!mounted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Load failed";
        setStatusMessage(message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadSpec]);

  const updateFromForm = (updater: (spec: BuildSpecV0) => BuildSpecV0) => {
    const next = updater(activeSpec);
    setJsonText(stringifySpec(next));
    setStatusMessage(null);
  };

  const handleModeChange = (mode: BuildSpecV0["mode"]) => {
    updateFromForm((spec) => ({ ...spec, mode }));
  };

  const handleCapabilityToggle = (
    capability: BuildSpecV0CapabilityId,
    checked: boolean
  ) => {
    updateFromForm((spec) => {
      const nextSet = new Set(spec.capabilities);
      if (checked) {
        if (!nextSet.has(capability) && nextSet.size >= 9) {
          setStatusMessage("Maximum of 9 capabilities.");
          return spec;
        }
        nextSet.add(capability);
      } else {
        nextSet.delete(capability);
      }

      const capabilities = CAPABILITY_IDS_V0.filter((id) => nextSet.has(id));
      return { ...spec, capabilities };
    });
  };

  const handleMetadataChange = (key: "clientId" | "siteId", value: string) => {
    updateFromForm((spec) => {
      const metadata = {
        ...(spec.metadata ?? {}),
        [key]: value,
      };

      if (!metadata.clientId) {
        delete metadata.clientId;
      }
      if (!metadata.siteId) {
        delete metadata.siteId;
      }

      if (Object.keys(metadata).length === 0) {
        const rest = { ...spec };
        delete rest.metadata;
        return rest;
      }

      return {
        ...spec,
        metadata,
      };
    });
  };

  const handleJsonFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(`${JSON.stringify(parsed, null, 2)}\n`);
      setStatusMessage("JSON formatted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      setStatusMessage(`Cannot format: ${message}`);
    }
  };

  const handleValidate = () => {
    if (validation.ok) {
      setStatusMessage("BuildSpec is valid.");
      return;
    }
    setStatusMessage("BuildSpec is invalid. Resolve the listed issues.");
  };

  const handleLoadExample = async () => {
    try {
      await loadSpec("example");
      setStatusMessage("Loaded example spec.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed";
      setStatusMessage(message);
    }
  };

  const handleLoadLocal = async () => {
    try {
      const data = await loadSpec("default");
      if (data.source !== "local") {
        setStatusMessage("No local override. Loaded example.");
      } else {
        setStatusMessage("Loaded local override.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed";
      setStatusMessage(message);
    }
  };

  const handleSaveLocal = async () => {
    if (!validation.ok) {
      setStatusMessage("Fix validation errors before saving.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/buildspec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonText }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setSource("local");
      setStatusMessage("Saved local override.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetLocal = async () => {
    if (!window.confirm("Delete local buildspec override?")) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/buildspec", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      await handleLoadExample();
      setSource("example");
      setStatusMessage("Local override removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!validation.ok) {
      return;
    }

    const blob = new Blob([stringifySpec(validation.spec)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buildspec.v0.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportRadiography = () => {
    if (!radiographyView) {
      return;
    }

    const blob = new Blob([`${JSON.stringify(radiographyView, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "radiography.v0.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleRadiographyInputChange = useCallback(
    (key: keyof RadiographyInputsState, value: string) => {
      setRadiographyInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const hasValidSpec = validation.ok && validation.spec.capabilities.length > 0;
  const hasSeedUrls = seedUrls.length > 0;
  const canRunRadiography = hasValidSpec && hasSeedUrls;

  const [radiographyView, setRadiographyView] = useState<RadiographyView | null>(
    null
  );

  useEffect(() => {
    if (!canRunRadiography || !validation.ok) {
      setRadiographyView(null);
      return;
    }

    try {
      const output = runRadiographyV0(
        {
          radiography_contract_version: "0.1.0",
          business_name: radiographyInputs.business_name,
          city: radiographyInputs.city,
          country: radiographyInputs.country,
          seed_urls: seedUrls,
          mode_hint: validation.spec.mode,
          language: radiographyInputs.language,
        },
        validation.spec
      );

      setRadiographyView(output);
    } catch {
      setRadiographyView({
        radiography_contract_version: "0.1.0",
        businessdna_schema_version: "0.1.0",
        buildspec_schema_version: "0.1.0",
        display_rules_version: "0.1.0",
        business_dna_patch: [],
        provenance_map: {},
        gap_report: {
          reason_codes: ["lint_violation"],
          unresolved_fields: [],
        },
        gating_decision: {
          status: "hard_fail",
          core_percent: 0,
          reason_codes: ["lint_violation"],
        },
        lint_report: [
          {
            rule_id: "NO_NUMBERS_WITHOUT_SOURCE",
            reason_code: "lint_violation",
            severity: "hard_fail",
            message: "Runner failed to produce a deterministic output.",
          },
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
            freshness: 0,
          },
        },
        composer_preset: {
          schemaVersion: "0.1.0",
          eventSchemaVersion: "0.1.0",
          mode: validation.spec.mode,
          capabilities: validation.spec.capabilities,
        },
        ghost_preview_config: {
          theme_id: "neutral-v0",
          layout_id: "single-column-v0",
          show_unverified: false,
        },
      });
    }
  }, [canRunRadiography, radiographyInputs, seedUrls, validation]);

  const isValid = validation.ok;

  return (
    <section className="mx-auto max-w-6xl py-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Studio</h1>

        <Link
          href="/"
          className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Volver
        </Link>
      </div>

      <p className="mt-3 text-zinc-400">
        BuildSpec v0 editor with strict validation and local override persistence.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`rounded-full border px-2.5 py-1 ${
            isValid
              ? "border-emerald-700 text-emerald-300"
              : "border-rose-700 text-rose-300"
          }`}
        >
          {isValid ? "VALID" : "INVALID"}
        </span>
        <span className="text-zinc-400">
          Source: <span className="text-zinc-200">{source.toUpperCase()}</span>
        </span>
        <span className="text-zinc-400">
          eventSchemaVersion: <span className="text-zinc-200">0.1.0</span>
        </span>
        {loading ? <span className="text-zinc-500">Working...</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`rounded-md border px-3 py-1.5 ${
            tab === "form"
              ? "border-zinc-500 text-zinc-100"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setTab("json")}
          className={`rounded-md border px-3 py-1.5 ${
            tab === "json"
              ? "border-zinc-500 text-zinc-100"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          JSON
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={handleLoadExample}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
        >
          Load Example
        </button>
        <button
          type="button"
          onClick={handleLoadLocal}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
        >
          Load Local
        </button>
        <button
          type="button"
          onClick={handleValidate}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={handleSaveLocal}
          disabled={!isValid || loading}
          className="rounded-md border border-emerald-700 px-3 py-1.5 text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Local
        </button>
        <button
          type="button"
          onClick={handleResetLocal}
          className="rounded-md border border-rose-700 px-3 py-1.5 text-rose-200 hover:border-rose-500"
        >
          Reset Local
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={!isValid}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export JSON
        </button>
      </div>

      {statusMessage ? (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          {tab === "form" ? (
            <div className="space-y-4 text-sm">
              <label className="block">
                <span className="text-zinc-300">Mode</span>
                <select
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={activeSpec.mode}
                  onChange={(event) =>
                    handleModeChange(event.target.value as BuildSpecV0["mode"])
                  }
                >
                  <option value="lead">lead</option>
                  <option value="booking">booking</option>
                  <option value="quote">quote</option>
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Capabilities</span>
                  <span className="text-zinc-400">
                    {activeSpec.capabilities.length}/9
                  </span>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {CAPABILITY_IDS_V0.map((capability) => {
                    const checked = activeSpec.capabilities.includes(capability);
                    const disableAdd =
                      !checked && activeSpec.capabilities.length >= 9;
                    return (
                      <label
                        key={capability}
                        className="flex items-center gap-2 text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disableAdd}
                          onChange={(event) =>
                            handleCapabilityToggle(capability, event.target.checked)
                          }
                        />
                        <span className="text-xs">{capability}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-zinc-300">metadata.clientId (optional)</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={activeSpec.metadata?.clientId ?? ""}
                  onChange={(event) =>
                    handleMetadataChange("clientId", event.target.value)
                  }
                />
              </label>

              <label className="block">
                <span className="text-zinc-300">metadata.siteId (optional)</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={activeSpec.metadata?.siteId ?? ""}
                  onChange={(event) =>
                    handleMetadataChange("siteId", event.target.value)
                  }
                />
              </label>

              <div className="text-zinc-400">
                eventSchemaVersion: <span className="text-zinc-200">0.1.0</span>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                className="min-h-[420px] w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                onClick={handleJsonFormat}
                className="mt-3 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Format
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm">
          <div className="text-zinc-200">Validation</div>

          {isValid ? (
            <div className="mt-3 text-zinc-300">
              <div className="text-zinc-200">
                schemaVersion: {validation.spec.schemaVersion}
              </div>
              <div className="mt-1 text-zinc-400">
                mode: <span className="text-zinc-200">{validation.spec.mode}</span>
              </div>
              <ul className="mt-2 list-disc pl-5 text-zinc-300">
                {validation.spec.capabilities.map((capability) => (
                  <li key={capability}>{capability}</li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="mt-3 list-disc pl-5 text-rose-300">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="text-zinc-200">Radiography Inputs</div>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-zinc-300">business_name</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={radiographyInputs.business_name}
                  onChange={(event) =>
                    handleRadiographyInputChange("business_name", event.target.value)
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-300">city</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={radiographyInputs.city}
                  onChange={(event) =>
                    handleRadiographyInputChange("city", event.target.value)
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-300">country</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={radiographyInputs.country}
                  onChange={(event) =>
                    handleRadiographyInputChange("country", event.target.value)
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-300">language</span>
                <input
                  className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  value={radiographyInputs.language}
                  onChange={(event) =>
                    handleRadiographyInputChange("language", event.target.value)
                  }
                />
              </label>
              <label className="block">
                <span className="text-zinc-300">seed_urls (one per line)</span>
                <textarea
                  className="mt-1 min-h-[96px] w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100"
                  value={radiographyInputs.seed_urls_text}
                  onChange={(event) =>
                    handleRadiographyInputChange("seed_urls_text", event.target.value)
                  }
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Stored locally in your browser (localStorage).
            </div>
          </div>

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
                  onClick={handleExportRadiography}
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
                <span className="text-zinc-200">{radiographyView.composer_preset.mode}</span>
                {" "}
                ({radiographyView.composer_preset.capabilities.length} capabilities)
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
