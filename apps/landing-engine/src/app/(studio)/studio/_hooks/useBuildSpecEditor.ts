import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CAPABILITY_IDS_V0,
  BuildSpecV0Schema,
  type BuildSpecV0
} from "@bax/buildspec";
import type {
  BuildSpecResponse,
  CapabilityId,
  LoadSpecSource,
  Source,
  Tab,
  ValidationState
} from "../_lib/types";
import { DEFAULT_SPEC } from "../_lib/constants";
import { formatZodIssues } from "@/lib/spec/formatZodIssues";

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

export type BuildSpecEditorController = {
  tab: Tab;
  setTab: (tab: Tab) => void;
  source: Source;
  jsonText: string;
  setJsonText: (value: string) => void;
  validation: ValidationState;
  activeSpec: BuildSpecV0;
  isValid: boolean;
  loading: boolean;
  statusMessage: string | null;
  handleModeChange: (mode: BuildSpecV0["mode"]) => void;
  handleCapabilityToggle: (capability: CapabilityId, checked: boolean) => void;
  handleMetadataChange: (key: "clientId" | "siteId", value: string) => void;
  handleJsonFormat: () => void;
  handleValidate: () => void;
  handleLoadExample: () => Promise<void>;
  handleLoadLocal: () => Promise<void>;
  handleSaveLocal: () => Promise<void>;
  handleResetLocal: () => Promise<void>;
  handleExport: () => void;
};

export const useBuildSpecEditor = (): BuildSpecEditorController => {
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

  const loadSpec = useCallback(async (requestSource: LoadSpecSource) => {
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

  const handleCapabilityToggle = (capability: CapabilityId, checked: boolean) => {
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
        [key]: value
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
        metadata
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
        body: JSON.stringify({ jsonText })
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
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buildspec.v0.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return {
    tab,
    setTab,
    source,
    jsonText,
    setJsonText,
    validation,
    activeSpec,
    isValid: validation.ok,
    loading,
    statusMessage,
    handleModeChange,
    handleCapabilityToggle,
    handleMetadataChange,
    handleJsonFormat,
    handleValidate,
    handleLoadExample,
    handleLoadLocal,
    handleSaveLocal,
    handleResetLocal,
    handleExport
  };
};
