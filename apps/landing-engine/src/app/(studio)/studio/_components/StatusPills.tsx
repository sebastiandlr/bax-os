import type { Source } from "../_lib/types";

type StatusPillsProps = {
  isValid: boolean;
  source: Source;
  loading: boolean;
};

export function StatusPills({ isValid, source, loading }: StatusPillsProps) {
  return (
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
  );
}
