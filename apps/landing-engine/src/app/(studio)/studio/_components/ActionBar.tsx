type ActionBarProps = {
  onLoadExample: () => void | Promise<void>;
  onLoadLocal: () => void | Promise<void>;
  onValidate: () => void;
  onSaveLocal: () => void | Promise<void>;
  onResetLocal: () => void | Promise<void>;
  onExport: () => void;
  isValid: boolean;
  loading: boolean;
};

export function ActionBar({
  onLoadExample,
  onLoadLocal,
  onValidate,
  onSaveLocal,
  onResetLocal,
  onExport,
  isValid,
  loading
}: ActionBarProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 text-sm">
      <button
        type="button"
        onClick={onLoadExample}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
      >
        Load Example
      </button>
      <button
        type="button"
        onClick={onLoadLocal}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
      >
        Load Local
      </button>
      <button
        type="button"
        onClick={onValidate}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500"
      >
        Validate
      </button>
      <button
        type="button"
        onClick={onSaveLocal}
        disabled={!isValid || loading}
        className="rounded-md border border-emerald-700 px-3 py-1.5 text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Local
      </button>
      <button
        type="button"
        onClick={onResetLocal}
        className="rounded-md border border-rose-700 px-3 py-1.5 text-rose-200 hover:border-rose-500"
      >
        Reset Local
      </button>
      <button
        type="button"
        onClick={onExport}
        disabled={!isValid}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export JSON
      </button>
    </div>
  );
}
