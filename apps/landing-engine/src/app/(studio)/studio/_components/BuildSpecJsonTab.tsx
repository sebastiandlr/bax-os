type BuildSpecJsonTabProps = {
  jsonText: string;
  onJsonChange: (value: string) => void;
  onFormat: () => void;
};

export function BuildSpecJsonTab({
  jsonText,
  onJsonChange,
  onFormat
}: BuildSpecJsonTabProps) {
  return (
    <div>
      <textarea
        className="min-h-[420px] w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
        value={jsonText}
        onChange={(event) => onJsonChange(event.target.value)}
        spellCheck={false}
      />
      <button
        type="button"
        onClick={onFormat}
        className="mt-3 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
      >
        Format
      </button>
    </div>
  );
}
