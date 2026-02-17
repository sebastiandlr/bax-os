"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EvidenceReplayResponseV0Schema } from "@bax/radiography-contract";
import {
  extractRequestIds,
  normalizeRunlogResponse,
  type RunlogApiError
} from "@/lib/radiography/runlogClient";
import { OperatorErrorPanel } from "../../_components/OperatorErrorPanel";

type EvidenceArtifact = {
  id: string;
  kind: string;
  sha256: string;
  bytes: number;
  created_at: string;
};

type EvidenceIndex = {
  run_id: string;
  created_at: string;
  artifacts: EvidenceArtifact[];
};

const isEvidenceArtifact = (value: unknown): value is EvidenceArtifact => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    typeof item.sha256 === "string" &&
    typeof item.bytes === "number" &&
    typeof item.created_at === "string"
  );
};

const parseEvidenceIndex = (value: unknown): EvidenceIndex | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (!body.evidence_index || typeof body.evidence_index !== "object") {
    return null;
  }

  const index = body.evidence_index as Record<string, unknown>;
  if (
    typeof index.run_id !== "string" ||
    typeof index.created_at !== "string" ||
    !Array.isArray(index.artifacts) ||
    !index.artifacts.every(isEvidenceArtifact)
  ) {
    return null;
  }

  return {
    run_id: index.run_id,
    created_at: index.created_at,
    artifacts: index.artifacts
  };
};

export default function EvidenceIndexPage() {
  const params = useParams<{ run_id: string }>();
  const runId = params.run_id;

  const [index, setIndex] = useState<EvidenceIndex | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operatorError, setOperatorError] = useState<RunlogApiError | null>(null);
  const [correlated, setCorrelated] = useState(false);
  const [strictReplay, setStrictReplay] = useState(true);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const [replayRequestId, setReplayRequestId] = useState<string | null>(null);
  const [replayError, setReplayError] = useState<RunlogApiError | null>(null);
  const [replayCorrelated, setReplayCorrelated] = useState(false);

  const loadEvidenceIndex = useCallback(async () => {
    setIsLoading(true);
    setOperatorError(null);

    try {
      const response = await fetch(`/api/radiography/runlog/evidence/${encodeURIComponent(runId)}`, {
        cache: "no-store"
      });
      const body = (await response.json()) as unknown;
      const normalized = normalizeRunlogResponse<Record<string, unknown>>(response, body, {
        mode: "runlog"
      });

      if (!normalized.ok) {
        setOperatorError(normalized);
        setCorrelated(extractRequestIds(response, body).correlated);
        setIndex(null);
        return;
      }

      const parsed = parseEvidenceIndex(normalized.data);
      if (!parsed) {
        setOperatorError({
          ok: false,
          error: "invalid",
          status: 500,
          ...(response.headers.get("x-request-id")
            ? { x_request_id: response.headers.get("x-request-id") ?? undefined }
            : {})
        });
        setCorrelated(false);
        setIndex(null);
        return;
      }

      setIndex(parsed);
      setCorrelated(false);
    } catch {
      setOperatorError({
        ok: false,
        error: "error",
        status: 500
      });
      setCorrelated(false);
      setIndex(null);
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadEvidenceIndex();
  }, [loadEvidenceIndex]);

  const handleReplay = useCallback(async () => {
    setReplayLoading(true);
    setReplayMessage(null);
    setReplayError(null);
    setReplayRequestId(null);

    try {
      const bundleResponse = await fetch(
        `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/bundle`,
        { cache: "no-store" }
      );
      const bundleBody = (await bundleResponse.json()) as unknown;
      const normalizedBundle = normalizeRunlogResponse<unknown>(bundleResponse, bundleBody, {
        mode: "runlog"
      });

      if (!normalizedBundle.ok) {
        setReplayError(normalizedBundle);
        setReplayCorrelated(extractRequestIds(bundleResponse, bundleBody).correlated);
        return;
      }

      const replayResponse = await fetch("/api/radiography/runlog/evidence/replay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          bundle: normalizedBundle.data,
          options: {
            strict: strictReplay
          }
        })
      });

      const replayBody = (await replayResponse.json()) as unknown;
      const normalizedReplay = normalizeRunlogResponse<unknown>(replayResponse, replayBody, {
        mode: "replay"
      });

      if (!normalizedReplay.ok) {
        setReplayError(normalizedReplay);
        setReplayCorrelated(extractRequestIds(replayResponse, replayBody).correlated);
        return;
      }

      const parsed = EvidenceReplayResponseV0Schema.safeParse(normalizedReplay.data);
      if (!parsed.success) {
        setReplayError({
          ok: false,
          error: "invalid",
          status: 500,
          ...(replayResponse.headers.get("x-request-id")
            ? { x_request_id: replayResponse.headers.get("x-request-id") ?? undefined }
            : {})
        });
        setReplayCorrelated(false);
        return;
      }

      setReplayRequestId(replayResponse.headers.get("x-request-id"));
      setReplayCorrelated(false);
      setReplayMessage(
        `match=${parsed.data.compare.match ? "true" : "false"} warnings=${parsed.data.compare.diff.integrity_warnings.length}`
      );
    } catch {
      setReplayError({
        ok: false,
        error: "error",
        status: 500
      });
      setReplayCorrelated(false);
    } finally {
      setReplayLoading(false);
    }
  }, [runId, strictReplay]);

  const replayPanel = useMemo(() => {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Replay</h2>
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={strictReplay}
            onChange={(event) => {
              setStrictReplay(event.target.checked);
            }}
          />
          strict
        </label>
        <button
          type="button"
          onClick={() => {
            void handleReplay();
          }}
          className="mt-3 rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          disabled={replayLoading}
        >
          {replayLoading ? "Replaying..." : "Replay"}
        </button>

        {replayRequestId ? (
          <div className="mt-2 text-xs text-zinc-400">x-request-id: {replayRequestId}</div>
        ) : null}
        {replayMessage ? <div className="mt-2 text-sm text-zinc-200">{replayMessage}</div> : null}
        {replayError ? (
          <div className="mt-3">
            <OperatorErrorPanel
              error={replayError}
              correlated={replayCorrelated}
              title="Replay Error"
            />
          </div>
        ) : null}
      </div>
    );
  }, [handleReplay, replayCorrelated, replayError, replayLoading, replayMessage, replayRequestId, strictReplay]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Evidence Index</h1>
          <p className="mt-1 text-sm text-zinc-400">run_id: {runId}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadEvidenceIndex();
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Refresh
          </button>
          <Link href={`/studio/runlogs/${encodeURIComponent(runId)}`} className="text-sm text-zinc-400 hover:text-zinc-200">
            Back to Run
          </Link>
        </div>
      </div>

      {isLoading ? <div className="text-zinc-400">Loading evidence index...</div> : null}

      {!isLoading && operatorError ? (
        <OperatorErrorPanel error={operatorError} correlated={correlated} />
      ) : null}

      {!isLoading && !operatorError && index ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="text-sm text-zinc-300">created_at: {index.created_at}</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm text-zinc-200">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-400">
                    <th className="px-3 py-2">artifact_id</th>
                    <th className="px-3 py-2">kind</th>
                    <th className="px-3 py-2">bytes</th>
                    <th className="px-3 py-2">created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {index.artifacts.map((artifact) => (
                    <tr key={artifact.id} className="border-b border-zinc-800/60">
                      <td className="px-3 py-2">
                        <Link
                          href={`/studio/runlogs/${encodeURIComponent(runId)}/evidence/${encodeURIComponent(artifact.id)}`}
                          className="text-blue-300 hover:underline"
                        >
                          {artifact.id}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{artifact.kind}</td>
                      <td className="px-3 py-2">{artifact.bytes}</td>
                      <td className="px-3 py-2">{artifact.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {replayPanel}
        </div>
      ) : null}
    </section>
  );
}
