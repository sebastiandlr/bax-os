"use client";

import type { RunlogApiError } from "@/lib/radiography/runlogClient";
import { toRedactedJson } from "@/lib/radiography/redaction";

type OperatorErrorPanelProps = {
  error: RunlogApiError;
  correlated: boolean;
  title?: string;
};

export function OperatorErrorPanel({
  error,
  correlated,
  title = "Operator Error"
}: OperatorErrorPanelProps) {
  return (
    <section className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-sm">
      <h2 className="text-sm font-semibold text-rose-200">{title}</h2>
      <div className="mt-2 text-rose-100">status: {error.status}</div>
      <div className="text-rose-100">error: {error.error}</div>
      <div className="text-rose-100">request_id: {error.request_id ?? "n/a"}</div>
      <div className="text-rose-100">x-request-id: {error.x_request_id ?? "n/a"}</div>
      <div className="text-rose-100">correlated: {correlated ? "true" : "false"}</div>

      {error.errors && error.errors.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-rose-100">
          {error.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {error.details !== undefined ? (
        <pre className="mt-3 overflow-auto rounded border border-rose-900/50 bg-zinc-950 p-3 text-xs text-zinc-200">
          {toRedactedJson(error.details)}
        </pre>
      ) : null}

      <p className="mt-3 text-xs text-rose-300">Support: share this request id.</p>
    </section>
  );
}
