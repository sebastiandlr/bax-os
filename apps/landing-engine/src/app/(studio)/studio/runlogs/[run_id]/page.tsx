"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RadiographyRunLogV0Schema, type RadiographyRunLogV0 } from "@bax/radiography-contract";
import {
  extractRequestIds,
  normalizeRunlogResponse,
  type RunlogApiError
} from "@/lib/radiography/runlogClient";
import { OperatorErrorPanel } from "../_components/OperatorErrorPanel";

type RunlogResponseBody = {
  ok?: unknown;
  runlog?: unknown;
};

export default function RunLogDetailPage() {
  const params = useParams<{ run_id: string }>();
  const runId = params.run_id;

  const [runlog, setRunlog] = useState<RadiographyRunLogV0 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operatorError, setOperatorError] = useState<RunlogApiError | null>(null);
  const [correlated, setCorrelated] = useState(false);
  const [requestHeaderId, setRequestHeaderId] = useState<string | null>(null);

  const loadRunlog = useCallback(async () => {
    setIsLoading(true);
    setOperatorError(null);

    try {
      const response = await fetch(`/api/radiography/runlog/${encodeURIComponent(runId)}`, {
        cache: "no-store"
      });
      const body = (await response.json()) as unknown;
      setRequestHeaderId(response.headers.get("x-request-id"));
      const normalized = normalizeRunlogResponse<RunlogResponseBody>(response, body, {
        mode: "runlog"
      });

      if (!normalized.ok) {
        setOperatorError(normalized);
        setCorrelated(extractRequestIds(response, body).correlated);
        setRunlog(null);
        return;
      }

      const parsed = RadiographyRunLogV0Schema.safeParse(normalized.data.runlog);
      if (!parsed.success) {
        setOperatorError({
          ok: false,
          error: "invalid",
          status: 500,
          ...(response.headers.get("x-request-id")
            ? { x_request_id: response.headers.get("x-request-id") ?? undefined }
            : {})
        });
        setCorrelated(false);
        setRunlog(null);
        return;
      }

      setRunlog(parsed.data);
      setCorrelated(false);
    } catch {
      setOperatorError({
        ok: false,
        error: "error",
        status: 500
      });
      setCorrelated(false);
      setRunlog(null);
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void loadRunlog();
  }, [loadRunlog]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Run Detail</h1>
          <p className="mt-1 text-sm text-zinc-400">run_id: {runId}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadRunlog();
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Refresh
          </button>
          <Link href="/studio/runlogs" className="text-sm text-zinc-400 hover:text-zinc-200">
            Back to Runs
          </Link>
        </div>
      </div>

      {isLoading ? <div className="text-zinc-400">Loading run detail...</div> : null}

      {!isLoading && operatorError ? (
        <OperatorErrorPanel error={operatorError} correlated={correlated} />
      ) : null}

      {!isLoading && !operatorError && runlog ? (
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="text-sm text-zinc-300">
            x-request-id: <span className="text-zinc-100">{requestHeaderId ?? "n/a"}</span>
          </div>
          <div className="text-sm text-zinc-300">
            created_at: <span className="text-zinc-100">{runlog.created_at}</span>
          </div>
          <div className="text-sm text-zinc-300">
            source: <span className="text-zinc-100">{runlog.source ?? "local_run"}</span>
          </div>
          <div className="text-sm text-zinc-300">
            is_stub: <span className="text-zinc-100">{runlog.is_stub ? "true" : "false"}</span>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
            <h2 className="text-sm font-medium text-zinc-200">Gating</h2>
            <div className="mt-2 text-sm text-zinc-300">
              status: <span className="text-zinc-100">{runlog.outputs.gating_decision.status}</span>
            </div>
            <div className="text-sm text-zinc-300">
              core_percent:{" "}
              <span className="text-zinc-100">{runlog.outputs.gating_decision.core_percent}</span>
            </div>
            <ul className="mt-2 list-disc pl-5 text-zinc-300">
              {runlog.outputs.gating_decision.reason_codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>

          <Link
            href={`/studio/runlogs/${encodeURIComponent(runlog.run_id)}/evidence`}
            className="inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Open Evidence Index
          </Link>
        </div>
      ) : null}
    </section>
  );
}
