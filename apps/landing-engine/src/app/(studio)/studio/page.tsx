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

const stringifySpec = (spec: BuildSpecV0): string => {
  return `${JSON.stringify(spec, null, 2)}\n`;
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

  const validation = useMemo(() => validateJsonText(jsonText), [jsonText]);
  const activeSpec = validation.ok ? validation.spec : lastValidSpec;

  useEffect(() => {
    if (validation.ok) {
      setLastValidSpec(validation.spec);
    }
  }, [validation]);

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

  const shouldRunRadiography =
    validation.ok && validation.spec.capabilities.length > 0;

  type RadiographyView = {
    contractVersion: string;
    display_rules_version: string;
    gating_decision: {
      status: string;
      core_percent: number;
      reason_codes: string[];
    };
    run_metadata: {
      unknown_fields_count: number;
    };
    composer_preset: {
      mode: string;
      capabilities: string[];
    };
  };

  const [radiographyView, setRadiographyView] = useState<RadiographyView | null>(
    null
  );

  useEffect(() => {
    if (!shouldRunRadiography || !validation.ok) {
      setRadiographyView(null);
      return;
    }

    try {
      const output = runRadiographyV0({
        contractVersion: "0.1.0",
        business_name: "PLACEHOLDER: BAX Demo",
        city: "PLACEHOLDER: CDMX",
        country: "PLACEHOLDER: MX",
        seed_urls: [],
        mode_hint: validation.spec.mode,
        language: "es",
      });

      setRadiographyView({
        contractVersion: output.contractVersion,
        display_rules_version: output.display_rules_version,
        gating_decision: output.gating_decision,
        run_metadata: {
          unknown_fields_count: output.run_metadata.unknown_fields_count,
        },
        composer_preset: output.composer_preset,
      });
    } catch {
      setRadiographyView({
        contractVersion: "0.1.0",
        display_rules_version: "0.1.0",
        gating_decision: {
          status: "blocked",
          core_percent: 0,
          reason_codes: ["missing_seed_url"],
        },
        run_metadata: {
          unknown_fields_count: 0,
        },
        composer_preset: {
          mode: validation.spec.mode,
          capabilities: validation.spec.capabilities,
        },
      });
    }
  }, [shouldRunRadiography, validation]);

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

          {!shouldRunRadiography ? (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-zinc-400">
              Radiography: blocked (invalid BuildSpec)
            </div>
          ) : null}

          {shouldRunRadiography && radiographyView ? (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-zinc-200">Radiography</div>
              <div className="mt-1 text-zinc-400">
                contractVersion:{" "}
                <span className="text-zinc-200">{radiographyView.contractVersion}</span>
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
                display_rules_version:{" "}
                <span className="text-zinc-200">{radiographyView.display_rules_version}</span>
              </div>
              <ul className="mt-2 list-disc pl-5 text-zinc-300">
                {radiographyView.gating_decision.reason_codes.map((reasonCode) => (
                  <li key={reasonCode}>{reasonCode}</li>
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
