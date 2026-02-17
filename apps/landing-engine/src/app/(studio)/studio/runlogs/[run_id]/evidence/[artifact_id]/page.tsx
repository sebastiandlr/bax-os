"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  extractRequestIds,
  normalizeRunlogResponse,
  type RunlogApiError
} from "@/lib/radiography/runlogClient";
import { toRedactedJson } from "@/lib/radiography/redaction";
import { OperatorErrorPanel } from "../../../_components/OperatorErrorPanel";

type EvidenceArtifactResponse = {
  ok?: unknown;
  artifact?: unknown;
};

type EvidenceArtifact = {
  id: string;
  kind: string;
  sha256: string;
  bytes: number;
  created_at: string;
  content: unknown;
};

const isEvidenceArtifact = (value: unknown): value is EvidenceArtifact => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const artifact = value as Record<string, unknown>;
  return (
    typeof artifact.id === "string" &&
    typeof artifact.kind === "string" &&
    typeof artifact.sha256 === "string" &&
    typeof artifact.bytes === "number" &&
    typeof artifact.created_at === "string" &&
    "content" in artifact
  );
};

export default function ArtifactViewPage() {
  const params = useParams<{ run_id: string; artifact_id: string }>();
  const runId = params.run_id;
  const artifactId = params.artifact_id;

  const [artifact, setArtifact] = useState<EvidenceArtifact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operatorError, setOperatorError] = useState<RunlogApiError | null>(null);
  const [correlated, setCorrelated] = useState(false);
  const [requestHeaderId, setRequestHeaderId] = useState<string | null>(null);

  const loadArtifact = useCallback(async () => {
    setIsLoading(true);
    setOperatorError(null);

    try {
      const response = await fetch(
        `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/artifact/${encodeURIComponent(artifactId)}`,
        { cache: "no-store" }
      );
      const body = (await response.json()) as unknown;
      setRequestHeaderId(response.headers.get("x-request-id"));

      const normalized = normalizeRunlogResponse<EvidenceArtifactResponse>(response, body, {
        mode: "runlog"
      });
      if (!normalized.ok) {
        setOperatorError(normalized);
        setCorrelated(extractRequestIds(response, body).correlated);
        setArtifact(null);
        return;
      }

      if (!isEvidenceArtifact(normalized.data.artifact)) {
        setOperatorError({
          ok: false,
          error: "invalid",
          status: 500,
          ...(response.headers.get("x-request-id")
            ? { x_request_id: response.headers.get("x-request-id") ?? undefined }
            : {})
        });
        setCorrelated(false);
        setArtifact(null);
        return;
      }

      setArtifact(normalized.data.artifact);
      setCorrelated(false);
    } catch {
      setOperatorError({
        ok: false,
        error: "error",
        status: 500
      });
      setCorrelated(false);
      setArtifact(null);
    } finally {
      setIsLoading(false);
    }
  }, [artifactId, runId]);

  useEffect(() => {
    void loadArtifact();
  }, [loadArtifact]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Artifact Viewer</h1>
          <p className="mt-1 text-sm text-zinc-400">
            run_id: {runId} / artifact_id: {artifactId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadArtifact();
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Refresh
          </button>
          <Link
            href={`/studio/runlogs/${encodeURIComponent(runId)}/evidence`}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Back to Evidence
          </Link>
        </div>
      </div>

      {isLoading ? <div className="text-zinc-400">Loading artifact...</div> : null}

      {!isLoading && operatorError ? (
        <OperatorErrorPanel error={operatorError} correlated={correlated} />
      ) : null}

      {!isLoading && !operatorError && artifact ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="text-sm text-zinc-300">x-request-id: {requestHeaderId ?? "n/a"}</div>
          <div className="mt-1 text-sm text-zinc-300">kind: {artifact.kind}</div>
          <div className="mt-1 text-sm text-zinc-300">bytes: {artifact.bytes}</div>
          <pre className="mt-3 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
            {toRedactedJson(artifact)}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
