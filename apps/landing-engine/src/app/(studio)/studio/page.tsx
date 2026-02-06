"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BuildSpecV0Schema, type BuildSpecV0 } from "@bax/buildspec";
import { runRadiographyV0 } from "@bax/radiography-runner";
import exampleSpec from "@/content/specs/buildspec.v0.example.json";
import { formatZodIssues } from "@/lib/spec/formatZodIssues";

type Source = "local" | "example";

type ValidationState =
  | { ok: true; spec: BuildSpecV0 }
  | { ok: false; errors: string[] };

const exampleJsonText = JSON.stringify(exampleSpec, null, 2);

const validateJson = (text: string): ValidationState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
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

export default function StudioPage() {
  const [editorText, setEditorText] = useState(exampleJsonText);
  const [source, setSource] = useState<Source>("example");
  const [validation, setValidation] = useState<ValidationState>(() =>
    validateJson(exampleJsonText)
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFromServer = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/buildspec");
      const data = (await response.json()) as {
        source: Source;
        jsonText: string;
      };
      setEditorText(data.jsonText);
      setSource(data.source);
      setValidation(validateJson(data.jsonText));
      if (data.source !== "local") {
        setStatusMessage("Local override not found. Loaded example.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  const handleLoadExample = () => {
    setEditorText(exampleJsonText);
    setSource("example");
    setValidation(validateJson(exampleJsonText));
    setStatusMessage("Loaded example spec.");
  };

  const handleLoadLocal = async () => {
    await loadFromServer();
  };

  const handleValidate = () => {
    setValidation(validateJson(editorText));
    setStatusMessage("Validation complete.");
  };

  const handleSaveLocal = async () => {
    const result = validateJson(editorText);
    setValidation(result);
    if (!result.ok) {
      setStatusMessage("Fix validation errors before saving.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/buildspec", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: editorText
      });
      if (!response.ok) {
        const data = (await response.json()) as { errors?: string[] };
        setStatusMessage(data.errors?.join(" | ") ?? "Save failed.");
        return;
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
    setLoading(true);
    setStatusMessage(null);
    try {
      await fetch("/api/buildspec", { method: "DELETE" });
      setEditorText(exampleJsonText);
      setSource("example");
      setValidation(validateJson(exampleJsonText));
      setStatusMessage("Local override removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset failed";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([editorText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buildspec.v0.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const radiography = useMemo(() => {
    if (!validation.ok) {
      return null;
    }
    return runRadiographyV0({
      contractVersion: "0.1.0",
      business_name: "BAX Demo",
      city: "CDMX",
      country: "MX",
      seed_urls: ["https://example.com"],
      mode_hint: "lead",
      language: "es"
    });
  }, [validation]);

  return (
    <section className="mx-auto max-w-5xl py-4">
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
        BuildSpec v0 editor. Validación estricta y persistencia local.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex items-center justify-between gap-4 text-sm text-zinc-400">
            <span>
              Source: <span className="text-zinc-200">{source.toUpperCase()}</span>
            </span>
            {loading ? <span>Working…</span> : null}
          </div>

          <textarea
            className="mt-3 min-h-[420px] w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            spellCheck={false}
          />

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
              onClick={handleSaveLocal}
              className="rounded-md border border-emerald-700 px-3 py-1.5 text-emerald-200 hover:border-emerald-500"
            >
              Save Local
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
              onClick={handleExport}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleResetLocal}
              className="rounded-md border border-rose-700 px-3 py-1.5 text-rose-200 hover:border-rose-500"
            >
              Reset Local
            </button>
          </div>

          {statusMessage ? (
            <div className="mt-3 text-xs text-zinc-400">{statusMessage}</div>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm">
          <div className="text-zinc-200">Validation</div>

          {validation.ok ? (
            <div className="mt-3 text-zinc-300">
              <div className="text-zinc-200">
                Schema v{validation.spec.schemaVersion}
              </div>
              <div className="mt-1 text-zinc-400">
                Mode: <span className="text-zinc-200">{validation.spec.mode}</span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-zinc-300">
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

          {validation.ok && radiography ? (
            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="text-zinc-200">Radiography</div>
              <div className="mt-1 text-zinc-400">
                Status: <span className="text-zinc-200">{radiography.gating_decision.status}</span>
              </div>
              <div className="mt-1 text-zinc-400">
                Reason codes: <span className="text-zinc-200">{radiography.gating_decision.reason_codes.length}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
