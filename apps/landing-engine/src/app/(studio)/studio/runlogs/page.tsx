"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  extractRequestIds,
  normalizeRunlogResponse,
  type RunlogApiError
} from "@/lib/radiography/runlogClient";
import type { RunLogListItem } from "../_lib/types";
import { OperatorErrorPanel } from "./_components/OperatorErrorPanel";

const isRunLogListItem = (value: unknown): value is RunLogListItem => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.run_id === "string" &&
    typeof item.created_at === "string" &&
    typeof item.duration_ms === "number" &&
    (item.status === "pass" ||
      item.status === "soft_fail" ||
      item.status === "hard_fail" ||
      item.status === "blocked") &&
    typeof item.core_percent === "number" &&
    Array.isArray(item.reason_codes) &&
    item.reason_codes.every((code) => typeof code === "string") &&
    typeof item.seed_urls_count === "number" &&
    typeof item.unique_hosts_count === "number"
  );
};

export default function RunLogsPage() {
  const [items, setItems] = useState<RunLogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [operatorError, setOperatorError] = useState<RunlogApiError | null>(null);
  const [correlated, setCorrelated] = useState(false);

  const loadRunLogs = useCallback(async () => {
    setIsLoading(true);
    setOperatorError(null);

    try {
      const response = await fetch("/api/radiography/runlog?limit=30", {
        cache: "no-store"
      });
      const body = (await response.json()) as unknown;
      const normalized = normalizeRunlogResponse<{ ok?: unknown; items?: unknown }>(response, body, {
        mode: "runlog"
      });

      if (!normalized.ok) {
        setOperatorError(normalized);
        setCorrelated(extractRequestIds(response, body).correlated);
        setItems([]);
        return;
      }

      const rawItems = Array.isArray(normalized.data.items) ? normalized.data.items : [];
      setItems(rawItems.filter(isRunLogListItem));
      setCorrelated(false);
    } catch {
      setOperatorError({
        ok: false,
        error: "error",
        status: 500
      });
      setCorrelated(false);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRunLogs();
  }, [loadRunLogs]);

  const content = useMemo(() => {
    if (isLoading) {
      return <div className="text-zinc-400">Loading run logs...</div>;
    }

    if (operatorError) {
      return <OperatorErrorPanel error={operatorError} correlated={correlated} />;
    }

    if (items.length === 0) {
      return <div className="text-zinc-400">No run logs available.</div>;
    }

    return (
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/30">
        <table className="min-w-full border-collapse text-sm text-zinc-200">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="px-3 py-2">run_id</th>
              <th className="px-3 py-2">created_at</th>
              <th className="px-3 py-2">status</th>
              <th className="px-3 py-2">core%</th>
              <th className="px-3 py-2">seed_urls</th>
              <th className="px-3 py-2">hosts</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.run_id} className="border-b border-zinc-800/60">
                <td className="px-3 py-2">
                  <Link
                    href={`/studio/runlogs/${encodeURIComponent(item.run_id)}`}
                    className="text-blue-300 hover:underline"
                  >
                    {item.run_id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-300">{item.created_at}</td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">{item.core_percent}</td>
                <td className="px-3 py-2">{item.seed_urls_count}</td>
                <td className="px-3 py-2">{item.unique_hosts_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [correlated, isLoading, items, operatorError]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Run Logs</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadRunLogs();
            }}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Refresh
          </button>
          <Link href="/studio" className="text-sm text-zinc-400 hover:text-zinc-200">
            Back to Studio
          </Link>
        </div>
      </div>
      {content}
    </section>
  );
}
