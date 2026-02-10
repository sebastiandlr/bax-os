import type { ReactNode } from "react";
import type { Source, Tab } from "../_lib/types";
import { ActionBar } from "./ActionBar";
import { StatusPills } from "./StatusPills";

type BuildSpecEditorProps = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  isValid: boolean;
  source: Source;
  loading: boolean;
  statusMessage: string | null;
  onLoadExample: () => void | Promise<void>;
  onLoadLocal: () => void | Promise<void>;
  onValidate: () => void;
  onSaveLocal: () => void | Promise<void>;
  onResetLocal: () => void | Promise<void>;
  onExport: () => void;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
};

export function BuildSpecEditor({
  tab,
  onTabChange,
  isValid,
  source,
  loading,
  statusMessage,
  onLoadExample,
  onLoadLocal,
  onValidate,
  onSaveLocal,
  onResetLocal,
  onExport,
  leftPanel,
  rightPanel
}: BuildSpecEditorProps) {
  return (
    <>
      <StatusPills isValid={isValid} source={source} loading={loading} />

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => onTabChange("form")}
          className={`rounded-md border px-3 py-1.5 ${
            tab === "form"
              ? "border-zinc-500 text-zinc-100"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => onTabChange("json")}
          className={`rounded-md border px-3 py-1.5 ${
            tab === "json"
              ? "border-zinc-500 text-zinc-100"
              : "border-zinc-700 text-zinc-300"
          }`}
        >
          JSON
        </button>
      </div>

      <ActionBar
        onLoadExample={onLoadExample}
        onLoadLocal={onLoadLocal}
        onValidate={onValidate}
        onSaveLocal={onSaveLocal}
        onResetLocal={onResetLocal}
        onExport={onExport}
        isValid={isValid}
        loading={loading}
      />

      {statusMessage ? (
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-300">
          {statusMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">{leftPanel}</div>
        {rightPanel}
      </div>
    </>
  );
}
